import IvsNetwork from '../lib/ivsnetwork.js';
import Helper from '../helper/helper.js';

const AdminCard = "admin@ivs-network";
const Network = new IvsNetwork(AdminCard);

const expireTime = 60 * 60;
const secret = 'secret';

module.exports = function(app, jwt, NS) {
  app.post('/api/logout', function(req, res) {
    var cardName = req.headers.authorization;
    var mynetwork = new MyNetwork(cardName);
    mynetwork.init().then(function () {
        return mynetwork.logout()
    }).then(function () { 
        res.json({ message: "User added Successfully" });
    }).catch(function(error) {
        console.log(error);
        res.status(500).json({ error: error.toString() })
    })
})


  /**
   * @param {userName, password}
   */
  app.post('/api/login', async function (req, res) {
    try {

      const {
        userName,
        password
      } = req.body;

      let userId = await Helper.GetUserId(userName, password);
      let userCard = await Helper.GetUserCard(userId);
      if (!userCard) throw new Error('user name or password not correct');

      //generate token
      let payload = {
        userId: userId
      };

      let accessToken = jwt.sign({
        payload,
        exp: Math.floor(Date.now() / 1000) + expireTime
      }, secret);

      res.status(200).json({
        result: {
          message: 'login success',
          accessToken: accessToken
        }
      });
    }
    catch (error) {
      res.status(500).json({error: error.toString()});
    }
  })

  /**
   * return user's received access request for asset, status no set return all
   * @param {userId, status} req
   */
  app.get('/api/getAccessRequestList', async function(req, res) {
    try {

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {status} = req.body;

      //connect network with user card
      let userCard = await Helper.GetUserCard(userId);
      let connection = userCard.getConnection();
      await userCard.connect();

      //check new status is within status type
      let statusTypes = ['UNDETERMINED', 'ACCEPT', 'DENY'];
      let filterStatus = 'ALL';

      if (statusTypes.includes(status)) {
        filterStatus = status;
      }

      //get received request
      let rRegistry = await connection.getAssetRegistry(`${NS}.Request`);

      //this list would containt my sent request and received request
      let requestList = await rRegistry.getAll();

      //filter out the request list if receiver is me
      let filtered = requestList.filter(e => e.receiverId == userId);

      //filter out the request list by status (UNDETERMINED / DENY / ACCEPT), default return all status
      if (!filterStatus == 'ALL') {
        filtered = filtered.filter(e => e.status == filterStatus);
      }
      
      await userCard.disconnect();

      //return my request list
      res.status(200).json({
        result: filtered
      });

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })


  /**
   * return the list of request user had sent
   * @param {userId} 
   */
  app.get('/api/getSentRequestList', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      //connect network with user card
      let userCard = await Helper.GetUserCard(userId);
      let connection = userCard.getConnection();
      await userCard.connect();

      //get sent request
      let rRegistry = await connection.getAssetRegistry(`${NS}.Request`);

      //this list would containt my sent request and received request
      let requestList = await rRegistry.getAll();

      //filter out the request list if receiver is me
      let filtered = requestList.filter(e => e.senderId == userId);
      
      await userCard.disconnect();

      res.status(200).json({
        result: filtered
      });

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {senderId, receiverId, assetId[], assetName} req
   */
  app.post('/api/requestAccessAsset', async function(req, res) {
    try {

      const {authorization} = req.headers;
      const {senderId} = Helper.GetTokenInfo(jwt, authorization, secret);
      //get request param
      const {
        receiverId,
        assetName,
        assetId
      } = req.body;

      //get sender info
      await Network.connect();

      let connection = Network.getConnection();
      let pRegistry = await connection.getParticipantRegistry(`${NS}.User`);

      //check sender and receiver exist
      // let sender = await pRegistry.get(senderId);
      let receiver = await pRegistry.get(receiverId);

      //check requested asset exist
      let aRegistry = await connection.getAssetRegistry(`${NS}.${assetName}`);
      let requestList = [];

      for (let i=0; i<assetId.length; i++) {
        let id = assetId[i];
        let targetAsset = await aRegistry.get(id);

        //check the requested asset is own by receiver
        let ownerId  = targetAsset.owner.getIdentifier();
        if (!(ownerId == receiverId)) throw new Error (`Asset Id: ${targetAsset.getIdentifier()} not own by receiver`);

        requestList.push(id);
      };

      
      //get sender's issued network id card 
      let iRegistry = await connection.getIdentityRegistry();
      let identities = await iRegistry.getAll();
      let filtered = identities.filter(identity => senderId == identity.participant.getIdentifier());
      
      if (filtered.length < 1) throw Error ('Sender not ID card');
      
      await Network.disconnect();

      //switch to sender profile from admin, create asset or submit transaction as sender ID
      let senderIdentity = filtered[0];
      let senderCard = new IvsNetwork(`${senderIdentity.name}@ivs-network`);

      let definition = await senderCard.connect();
      connection = senderCard.getConnection();

      //new transaction
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'RequestAccessAsset');
      // transaction.senderId = senderId;
      transaction.receiverId = receiverId;
      transaction.assetName = assetName;
      transaction.assetId = requestList;

      //submit request access asset transaction
      await connection.submitTransaction(transaction);
      await senderCard.disconnect();
    
      res.status(200).json({
        result: 'Reqeust sent'
      });

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {userId, requestId, newStatus} req
   */
  app.put('/api/updateRequestStatus', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        requestId,
        newStatus
      } = req.body;

      //connect network as user
      let userCard = await Helper.GetUserCard(userId);
      let definition = await userCard.connect();
      let connection = userCard.getConnection();

      //submit UpdateRequestStatus as current user
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'UpdateRequestStatus');
      transaction.requestId = requestId;
      transaction.newStatus = newStatus;

      await connection.submitTransaction(transaction);

      //disconnect network
      await userCard.disconnect();

      res.status(200).json({
        result: 'Update success'
      });

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {userId, channelName, members[]} req
   */
  app.post('/api/createChannel',  async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        channelName,
        members
      } = req.body;

      //connect network as user
      let userCard = await Helper.GetUserCard(userId);
      let definition = await userCard.connect();
      let connection = userCard.getConnection();

      //submit transaction
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'CreateChannel');
      transaction.name = channelName;
      transaction.members = members;

      await connection.submitTransaction(transaction);

      //dissconnect network
      await userCard.disconnect();

      res.status(200).json({
        result: 'Create success'
      });
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {userId, channelId, newMembers[]} req
   */
  app.put('/api/inviteChannelMember', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        channelId,
        newMembers
      } = req.body;

      //connect network as user
      let userCard = await Helper.GetUserCard(userId);
      let definition = await userCard.connect();
      let connection = userCard.getConnection();

      //submit UpdateRequestStatus as current user
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'InviteChannelMember');
      transaction.channelId = channelId;
      transaction.users = newMembers;

      await connection.submitTransaction(transaction);

      //disconnect network
      await userCard.disconnect();

      res.status(200).json({
        result: 'Update success'
      });
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {userId, channelId, removeMebers[]} req
   */
  app.put('/api/removeChannelMember', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        channelId,
        removeMebers
      } = req.body;

      //connect network as user
      let userCard = await Helper.GetUserCard(userId);
      let definition = await userCard.connect();
      let connection = userCard.getConnection();

      //submit UpdateRequestStatus as current user
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'RemoveChannelMember');
      transaction.channelId = channelId;
      transaction.users = removeMebers;

      await connection.submitTransaction(transaction);

      //disconnect network
      await userCard.disconnect();

      res.status(200).json({
        result: 'Update success'
      });
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {userId} req
   * return user belong channel
   */
  app.get('/api/getUserChannel', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      //connect network as user
      let userCard = await Helper.GetUserCard(userId);
      let connection = userCard.getConnection();
      await userCard.connect();

      //get all channel list
      let registry = await connection.getParticipantRegistry(`${NS}.Channel`)
      let channelList = await registry.getAll();

      //filter user belong channel
      let filtered = channelList.filter(e => e.members.includes(userId));

      //return filtered list
      res.status(200).json({
        result: filtered
      });
    }
    
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })
};