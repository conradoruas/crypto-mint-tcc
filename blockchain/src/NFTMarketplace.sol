// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NFTMarketplace
/// @notice Marketplace genérico que suporta qualquer coleção ERC721.
///         Integra com NFTCollectionFactory — qualquer coleção criada pela factory
///         pode listar, comprar, fazer e aceitar ofertas aqui.
contract NFTMarketplace is Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Taxa do marketplace cobrada sobre cada venda (basis points, ex: 250 = 2.5%)
    uint256 public marketplaceFee = 250;

    /// @notice Duração padrão de uma oferta
    uint256 public constant OFFER_DURATION = 7 days;

    struct Listing {
        address seller;
        uint256 price;
        bool    active;
    }

    struct Offer {
        address buyer;
        uint256 amount;
        uint256 expiresAt;
        bool    active;
    }

    /// @notice nftContract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    /// @notice nftContract => tokenId => buyer => Offer
    mapping(address => mapping(uint256 => mapping(address => Offer))) public offers;

    /// @notice nftContract => tokenId => lista de compradores que já ofertaram
    mapping(address => mapping(uint256 => address[])) private _offerBuyers;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
    event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt);
    event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 amount);
    event OfferCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed buyer);
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Marketplace — Listagem
    // ─────────────────────────────────────────────

    /// @notice Coloca um NFT de qualquer coleção ERC721 à venda
    /// @param nftContract Endereço do contrato da coleção
    /// @param tokenId     ID do token a ser listado
    /// @param price       Preço em wei (mínimo 0.0001 ETH)
    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) == msg.sender, "Voce nao e o dono deste NFT");
        require(price >= 0.0001 ether, "Preco minimo e 0.0001 ETH");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Contrato nao aprovado para transferir este NFT"
        );
        require(!listings[nftContract][tokenId].active, "NFT ja esta listado");

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            price:  price,
            active: true
        });

        emit ItemListed(nftContract, tokenId, msg.sender, price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Compra
    // ─────────────────────────────────────────────

    /// @notice Compra um NFT listado. Respeita royalties ERC2981 se implementado.
    /// @param nftContract Endereço do contrato da coleção
    /// @param tokenId     ID do token a ser comprado
    function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];

        require(listing.active, "NFT nao esta a venda");
        require(msg.value >= listing.price, "Valor enviado insuficiente");
        require(msg.sender != listing.seller, "Vendedor nao pode comprar o proprio NFT");

        delete listings[nftContract][tokenId];

        (, uint256 royaltyFee, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, listing.price);

        // Transfere o NFT
        IERC721(nftContract).transferFrom(listing.seller, msg.sender, tokenId);

        // Paga o vendedor
        (bool sellerPaid, ) = payable(listing.seller).call{value: sellerProceeds}("");
        require(sellerPaid, "Pagamento ao vendedor falhou");

        // ✅ Paga royalties — usa apenas um try/catch sem código duplicado
        if (royaltyFee > 0) {
            try IERC2981(nftContract).royaltyInfo(tokenId, listing.price) returns (address receiver, uint256) {
                if (receiver != address(0)) {
                    (bool royaltyPaid, ) = payable(receiver).call{value: royaltyFee}("");
                    require(royaltyPaid, "Pagamento de royalty falhou");
                }
            } catch {}
        }

        // Devolve troco
        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Devolucao do troco falhou");
        }

        emit ItemSold(nftContract, tokenId, listing.seller, msg.sender, listing.price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Cancelamento de listagem
    // ─────────────────────────────────────────────

    /// @param nftContract Endereço do contrato da coleção
    /// @param tokenId     ID do token
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing memory listing = listings[nftContract][tokenId];

        require(listing.active, "NFT nao esta listado");
        require(listing.seller == msg.sender || msg.sender == owner(), "Sem permissao para cancelar");

        delete listings[nftContract][tokenId];

        emit ListingCancelled(nftContract, tokenId, listing.seller);
    }

    // ─────────────────────────────────────────────
    // Ofertas — Fazer oferta
    // ─────────────────────────────────────────────

    /// @param nftContract Endereço do contrato da coleção
    /// @param tokenId     ID do token
    function makeOffer(address nftContract, uint256 tokenId) external payable nonReentrant {
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) != address(0), "Token nao existe");
        require(msg.value >= 0.0001 ether, "Oferta minima e 0.0001 ETH");
        require(nft.ownerOf(tokenId) != msg.sender, "Dono nao pode ofertar no proprio NFT");
        require(!offers[nftContract][tokenId][msg.sender].active, "Voce ja tem uma oferta ativa neste NFT");

        uint256 expiresAt = block.timestamp + OFFER_DURATION;

        offers[nftContract][tokenId][msg.sender] = Offer({
            buyer:     msg.sender,
            amount:    msg.value,
            expiresAt: expiresAt,
            active:    true
        });

        _offerBuyers[nftContract][tokenId].push(msg.sender);

        emit OfferMade(nftContract, tokenId, msg.sender, msg.value, expiresAt);
    }

    // ─────────────────────────────────────────────
    // Ofertas — Aceitar oferta
    // ─────────────────────────────────────────────

    /// @param nftContract Endereço do contrato da coleção
    /// @param tokenId     ID do token
    /// @param buyer       Endereço do comprador cuja oferta será aceita
    function acceptOffer(address nftContract, uint256 tokenId, address buyer) external nonReentrant {
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) == msg.sender, "Voce nao e o dono deste NFT");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Contrato nao aprovado para transferir este NFT"
        );

        Offer memory offer = offers[nftContract][tokenId][buyer];
        require(offer.active, "Oferta nao esta ativa");
        require(block.timestamp <= offer.expiresAt, "Oferta expirou");

        delete offers[nftContract][tokenId][buyer];

        if (listings[nftContract][tokenId].active) {
            delete listings[nftContract][tokenId];
            emit ListingCancelled(nftContract, tokenId, msg.sender);
        }

        (, uint256 royaltyFee, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, offer.amount);

        nft.transferFrom(msg.sender, buyer, tokenId);

        // Paga o vendedor
        (bool sellerPaid, ) = payable(msg.sender).call{value: sellerProceeds}("");
        require(sellerPaid, "Pagamento ao vendedor falhou");

        // ✅ Paga royalties — mesmo padrão do buyItem
        if (royaltyFee > 0) {
            try IERC2981(nftContract).royaltyInfo(tokenId, offer.amount) returns (address receiver, uint256) {
                if (receiver != address(0)) {
                    (bool royaltyPaid, ) = payable(receiver).call{value: royaltyFee}("");
                    require(royaltyPaid, "Pagamento de royalty falhou");
                }
            } catch {}
        }

        emit OfferAccepted(nftContract, tokenId, msg.sender, buyer, offer.amount);
    }

    // ─────────────────────────────────────────────
    // Ofertas — Cancelar oferta
    // ─────────────────────────────────────────────

    /// @param nftContract Endereço do contrato da coleção
    /// @param tokenId     ID do token
    function cancelOffer(address nftContract, uint256 tokenId) external nonReentrant {
        Offer memory offer = offers[nftContract][tokenId][msg.sender];
        require(offer.active, "Voce nao tem oferta ativa neste NFT");

        delete offers[nftContract][tokenId][msg.sender];

        (bool refunded, ) = payable(msg.sender).call{value: offer.amount}("");
        require(refunded, "Reembolso falhou");

        emit OfferCancelled(nftContract, tokenId, msg.sender);
    }

    /// @notice Resgata ETH de oferta expirada de volta ao comprador original
    function reclaimExpiredOffer(address nftContract, uint256 tokenId, address buyer) external nonReentrant {
        Offer memory offer = offers[nftContract][tokenId][buyer];
        require(offer.active, "Oferta nao esta ativa");
        require(block.timestamp > offer.expiresAt, "Oferta ainda nao expirou");

        delete offers[nftContract][tokenId][buyer];

        (bool refunded, ) = payable(buyer).call{value: offer.amount}("");
        require(refunded, "Reembolso falhou");

        emit OfferCancelled(nftContract, tokenId, buyer);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }

    function getOffer(address nftContract, uint256 tokenId, address buyer) external view returns (Offer memory) {
        return offers[nftContract][tokenId][buyer];
    }

    function getOfferBuyers(address nftContract, uint256 tokenId) external view returns (address[] memory) {
        return _offerBuyers[nftContract][tokenId];
    }

    // ─────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────

    /// @notice Calcula taxas do marketplace e royalties ERC2981
    /// @return marketFee      Taxa do marketplace
    /// @return royaltyFee     Royalty para o criador (0 se não implementado)
    /// @return sellerProceeds Valor líquido para o vendedor
    function _calculateFees(address nftContract, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (uint256 marketFee, uint256 royaltyFee, uint256 sellerProceeds)
    {
        marketFee  = (salePrice * marketplaceFee) / 10000;
        royaltyFee = 0;

        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (address, uint256 royaltyAmount) {
            royaltyFee = royaltyAmount;
        } catch {}

        require(marketFee + royaltyFee <= salePrice, "Taxas excedem o preco de venda");

        sellerProceeds = salePrice - marketFee - royaltyFee;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /// @notice Altera a taxa do marketplace (basis points, máximo 10%)
    /// @param newFee Nova taxa em basis points (ex: 250 = 2.5%)
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Taxa maxima e 10%");
        uint256 oldFee = marketplaceFee;
        marketplaceFee = newFee;
        emit MarketplaceFeeUpdated(oldFee, newFee);
    }

    /// @notice Saca todas as taxas acumuladas para o dono do marketplace
    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Transferencia falhou");
    }

    /// @notice Aceita ETH enviado diretamente (taxas acumuladas via buyItem/acceptOffer)
    receive() external payable {}
}