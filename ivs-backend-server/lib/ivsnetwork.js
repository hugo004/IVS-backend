"use strict"

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const IdCard = require('composer-common').IdCard;
const FileSystemCardStore = require('composer-common').FileSystemCardStore;
const BusinessNetworkCardStore = require('composer-common').BusinessNetworkCardStore;
const AdminConnection = require('composer-admin').AdminConnection;


class IvsNetwork {
  constructor(cardName="admin@ivs-network") {
    this.currentParticipantId;
    this.cardName = cardName;
    this.connection = new BusinessNetworkConnection();
  }

  getConnection() {
    return this.connection;
  }


  connect() {
    var _this = this;

    //connection the network
    return this.connection.connect(this.cardName).then((result) => {
      _this.businessNetworkDefinition = result;
      _this.serializer = _this.businessNetworkDefinition.getSerializer();
      return result;
    });
  }

  disconnect() {
    return this.connection.disconnect();
  }

  ping() {
    var _this = this;
    return this.connection.ping().then(function (result) {
      return result;
    })
  }

  logout() {
    var _this = this;
    return this.ping().then(function(){
      return adminConnection.deleteCard(_this.cardName)
    })
  }



  // static importCardToNetwork(cardData) {
  //   var _idCardData, _idCardName;
  //   var businessNetworkConnection = new BusinessNetworkConnection();
  //   return IdCard.fromArchive(cardData).then(function(idCardData) {
  //     _idCardData = idCardData;
  //     return BusinessNetworkCardStore.getDefaultCardName(idCardData)
  //   }).then(function(idCardName) {
  //     _idCardName = idCardName;
  //     return fileSystemCardStore.put(_idCardName, _idCardData)
  //   }).then(function(result) {
  //     return adminConnection.importCard(_idCardName, _idCardData);
  //   }).then(function(imported) {
  //     if (imported) {
  //       return businessNetworkConnection.connect(_idCardName)
  //     } else {
  //       return null;
  //     }
  //   }).then(function(businessNetworkDefinition){
  //     if (!businessNetworkDefinition) {
  //       return null
  //     }
  //     return _idCardName;
  //   })
  // }
}

export default IvsNetwork;