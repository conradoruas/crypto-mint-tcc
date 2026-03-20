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

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenUri);

    modifier onlyFactory() {
        _onlyFactory();
        _;
    }

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

    function mint(address to, string memory tokenUri) external payable {
        require(_nextTokenId < maxSupply, "Supply esgotado");
        require(msg.value >= mintPrice, "Valor insuficiente");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);

        emit NFTMinted(to, tokenId, tokenUri);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
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

    function _onlyFactory() internal view {
      require(msg.sender == factory, "Apenas a factory pode chamar isso");
    }
}