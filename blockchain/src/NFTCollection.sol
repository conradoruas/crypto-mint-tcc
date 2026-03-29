// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract NFTCollection is ERC721URIStorage, ERC2981, Ownable {

    uint256 private _nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;
    string  public collectionDescription;
    string  public collectionImage;
    address public factory;

    // ✅ Lista de URIs pré-carregadas pelo dono
    string[] private _tokenURIs;
    bool     public  revealed; // false = metadata oculta até o reveal

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenUri);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _image,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address _creator,
        address _factory
    ) ERC721(_name, _symbol) Ownable(_creator) {
        collectionDescription = _description;
        collectionImage       = _image;
        maxSupply             = _maxSupply;
        mintPrice             = _mintPrice;
        factory               = _factory;
    }

    // ─── Dono carrega os URIs antes do lançamento ───
    function loadTokenURIs(string[] calldata uris) external onlyOwner {
        require(_nextTokenId == 0, "Mint ja iniciado");
        require(_tokenURIs.length + uris.length <= maxSupply, "Excede maxSupply");
        for (uint256 i = 0; i < uris.length; i++) {
            _tokenURIs.push(uris[i]);
        }
        require(_tokenURIs.length <= maxSupply, "Excede maxSupply");
    }

    function appendTokenURIs(string[] calldata uris) external onlyOwner {
        require(_nextTokenId == 0, "Mint ja iniciado");
        require(_tokenURIs.length + uris.length <= maxSupply, "Excede maxSupply");
        for (uint256 i = 0; i < uris.length; i++) {
            _tokenURIs.push(uris[i]);
        }
    }

    // ─── Mint público — recebe URI aleatória ───
    function mint(address to) external payable {
        require(_tokenURIs.length == maxSupply, "URIs nao carregadas");
        require(_nextTokenId < maxSupply, "Supply esgotado");
        require(msg.value >= mintPrice, "Valor insuficiente");

        // Pseudoaleatoriedade suficiente para TCC
        // (produção usaria Chainlink VRF)
        uint256 remaining = maxSupply - _nextTokenId;
        uint256 randomIndex = uint256(
            keccak256(abi.encodePacked(block.timestamp, block.prevrandao, to, _nextTokenId))
        ) % remaining;

        // Troca o índice sorteado com o último disponível (Fisher-Yates)
        uint256 tokenId = _nextTokenId;
        string memory uri = _tokenURIs[randomIndex];
        _tokenURIs[randomIndex] = _tokenURIs[remaining - 1];
        _tokenURIs[remaining - 1] = uri;

        _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(to, tokenId, uri);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function urisLoaded() external view returns (bool) {
        return _tokenURIs.length == maxSupply;
    }

    function withdraw() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "Saque falhou");
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}