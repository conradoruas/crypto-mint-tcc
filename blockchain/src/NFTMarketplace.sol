// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTMarketplace is ERC721URIStorage, ERC2981, Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public mintPrice = 0.0001 ether;

    /// @notice Taxa do marketplace cobrada sobre cada venda (basis points, ex: 250 = 2.5%)
    uint256 public marketplaceFee = 250;

    /// @notice Duração padrão de uma oferta
    uint256 public constant OFFER_DURATION = 7 days;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    struct Offer {
        address buyer;
        uint256 amount;
        uint256 expiresAt;
        bool active;
    }

    /// @notice tokenId => Listing
    mapping(uint256 => Listing) public listings;

    /// @notice tokenId => buyer => Offer
    mapping(uint256 => mapping(address => Offer)) public offers;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenUri);
    event ItemListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event OfferMade(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt);
    event OfferAccepted(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 amount);
    event OfferCancelled(uint256 indexed tokenId, address indexed buyer);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Mint
    // ─────────────────────────────────────────────

    /// @notice Minta um novo NFT com a URI do IPFS gerada no frontend
    function mint(string memory tokenUri) external payable {
        require(_nextTokenId < MAX_SUPPLY, "Excedeu o supply total");
        require(msg.value >= mintPrice, "Saldo insuficiente");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);

        emit NFTMinted(msg.sender, tokenId, tokenUri);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Listagem
    // ─────────────────────────────────────────────

    /// @notice Coloca um NFT à venda no marketplace
    /// @dev O vendedor precisa aprovar o contrato antes via setApprovalForAll ou approve
    function listItem(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Voce nao e o dono deste NFT");
        require(price >= 0.0001 ether, "Preco minimo e 0.0001 ETH");
        require(
            getApproved(tokenId) == address(this) || isApprovedForAll(msg.sender, address(this)),
            "Contrato nao aprovado para transferir este NFT"
        );
        require(!listings[tokenId].active, "NFT ja esta listado");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit ItemListed(tokenId, msg.sender, price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Compra
    // ─────────────────────────────────────────────

    /// @notice Compra um NFT listado no marketplace
    function buyItem(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];

        require(listing.active, "NFT nao esta a venda");
        require(msg.value >= listing.price, "Valor enviado insuficiente");
        require(msg.sender != listing.seller, "Vendedor nao pode comprar o proprio NFT");

        // Remove listagem antes de qualquer transferência
        delete listings[tokenId];

        uint256 fee = (listing.price * marketplaceFee) / 10000;
        uint256 sellerProceeds = listing.price - fee;

        _transfer(listing.seller, msg.sender, tokenId);

        (bool sellerPaid, ) = payable(listing.seller).call{value: sellerProceeds}("");
        require(sellerPaid, "Pagamento ao vendedor falhou");

        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Devolucao do troco falhou");
        }

        emit ItemSold(tokenId, listing.seller, msg.sender, listing.price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Cancelamento de listagem
    // ─────────────────────────────────────────────

    /// @notice Cancela a listagem de um NFT
    function cancelListing(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];

        require(listing.active, "NFT nao esta listado");
        require(listing.seller == msg.sender || msg.sender == owner(), "Sem permissao para cancelar");

        delete listings[tokenId];

        emit ListingCancelled(tokenId, listing.seller);
    }

    // ─────────────────────────────────────────────
    // Ofertas — Fazer oferta
    // ─────────────────────────────────────────────

    /// @notice Faz uma oferta em qualquer NFT. O ETH fica custodiado no contrato
    ///         até a oferta ser aceita, cancelada ou expirar (7 dias).
    /// @dev Só uma oferta ativa por comprador por tokenId.
    ///      Para aumentar uma oferta, cancele a anterior e faça uma nova.
    function makeOffer(uint256 tokenId) external payable nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Token nao existe");
        require(msg.value >= 0.0001 ether, "Oferta minima e 0.0001 ETH");
        require(ownerOf(tokenId) != msg.sender, "Dono nao pode ofertar no proprio NFT");
        require(!offers[tokenId][msg.sender].active, "Voce ja tem uma oferta ativa neste NFT");

        uint256 expiresAt = block.timestamp + OFFER_DURATION;

        offers[tokenId][msg.sender] = Offer({
            buyer: msg.sender,
            amount: msg.value,
            expiresAt: expiresAt,
            active: true
        });

        emit OfferMade(tokenId, msg.sender, msg.value, expiresAt);
    }

    // ─────────────────────────────────────────────
    // Ofertas — Aceitar oferta
    // ─────────────────────────────────────────────

    /// @notice O dono aceita a oferta de um comprador específico.
    ///         O NFT é transferido e o vendedor recebe o valor (menos taxa).
    ///         Se havia uma listagem ativa, ela é cancelada automaticamente.
    /// @param tokenId ID do token
    /// @param buyer Endereço do comprador cuja oferta será aceita
    function acceptOffer(uint256 tokenId, address buyer) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Voce nao e o dono deste NFT");
        require(
            getApproved(tokenId) == address(this) || isApprovedForAll(msg.sender, address(this)),
            "Contrato nao aprovado para transferir este NFT"
        );

        Offer memory offer = offers[tokenId][buyer];
        require(offer.active, "Oferta nao esta ativa");
        require(block.timestamp <= offer.expiresAt, "Oferta expirou");

        // Remove oferta e listagem antes de qualquer transferência
        delete offers[tokenId][buyer];
        if (listings[tokenId].active) {
            delete listings[tokenId];
            emit ListingCancelled(tokenId, msg.sender);
        }

        uint256 fee = (offer.amount * marketplaceFee) / 10000;
        uint256 sellerProceeds = offer.amount - fee;

        _transfer(msg.sender, buyer, tokenId);

        (bool sellerPaid, ) = payable(msg.sender).call{value: sellerProceeds}("");
        require(sellerPaid, "Pagamento ao vendedor falhou");

        emit OfferAccepted(tokenId, msg.sender, buyer, offer.amount);
    }

    // ─────────────────────────────────────────────
    // Ofertas — Cancelar oferta
    // ─────────────────────────────────────────────

    /// @notice O comprador cancela a própria oferta e recebe o ETH de volta.
    function cancelOffer(uint256 tokenId) external nonReentrant {
        Offer memory offer = offers[tokenId][msg.sender];
        require(offer.active, "Voce nao tem oferta ativa neste NFT");

        delete offers[tokenId][msg.sender];

        (bool refunded, ) = payable(msg.sender).call{value: offer.amount}("");
        require(refunded, "Reembolso falhou");

        emit OfferCancelled(tokenId, msg.sender);
    }

    /// @notice Qualquer pessoa pode resgatar o ETH de uma oferta expirada
    ///         de volta ao comprador original.
    /// @param tokenId ID do token
    /// @param buyer Endereço do comprador da oferta expirada
    function reclaimExpiredOffer(uint256 tokenId, address buyer) external nonReentrant {
        Offer memory offer = offers[tokenId][buyer];
        require(offer.active, "Oferta nao esta ativa");
        require(block.timestamp > offer.expiresAt, "Oferta ainda nao expirou");

        delete offers[tokenId][buyer];

        (bool refunded, ) = payable(buyer).call{value: offer.amount}("");
        require(refunded, "Reembolso falhou");

        emit OfferCancelled(tokenId, buyer);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Retorna os dados de listagem de um token
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    /// @notice Retorna os dados de uma oferta específica
    function getOffer(uint256 tokenId, address buyer) external view returns (Offer memory) {
        return offers[tokenId][buyer];
    }

    /// @notice Retorna o total de NFTs mintados
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /// @notice Atualiza a taxa do marketplace (máximo 10%)
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Taxa maxima e 10%");
        marketplaceFee = newFee;
    }

    /// @notice Configura royalties do contrato
    function setRoyalties(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /// @notice Saca o saldo de taxas acumuladas no contrato
    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Transferencia falhou");
    }

    // ─────────────────────────────────────────────
    // Overrides
    // ─────────────────────────────────────────────

    /// @dev Cancela automaticamente a listagem se o NFT for transferido fora do marketplace
    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) {
        if (listings[tokenId].active) {
            delete listings[tokenId];
            emit ListingCancelled(tokenId, from);
        }
        super.transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}