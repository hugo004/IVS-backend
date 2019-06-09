import IvsNetwork from '../lib/ivsnetwork.js';
import Helper from '../helper/helper.js';
import Config from '../config/config.js';

const AdminCard = "admin@ivs-network";
const Network = new IvsNetwork(AdminCard);

const expireTime = 60 * 60;
const secret = Config.secret;

// const userCardPool = new Map();

module.exports = function(app, jwt, NS, userCardPool) {
  app.post('/api/logout', async function(req, res) {

    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      await userCard.disconnect();

      //remove user card from pool
      userCardPool.delete(userId);

      res.status(200).end();

    }
    catch (error) {
      res.status(401).json({error: error.toString()});
    }
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

      let userInfo = await Helper.GetUserInfo(userId);
      let {firstName, lastName} = userInfo.baseInfo;

      //generate token
      let payload = {
        userId: userId,
        userName: `${lastName} ${firstName}`
      };

      let accessToken = jwt.sign({
        payload,
        exp: Math.floor(Date.now() / 1000) + expireTime
      }, secret);


      //connect the network when user login and put logined user card into pool
      await userCard.connect();
      userCardPool.set(userId, userCard);

      res.status(200).json({
        result: {
          message: 'login success',
          accessToken: accessToken,
          userInfo: JSON.stringify(userInfo)
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
      const {status} = req.query;

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let connection = userCard.getConnection();


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
      if (!(filterStatus == 'ALL')) {
        filtered = filtered.filter(e => e.status == filterStatus);
      }

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

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let connection = userCard.getConnection();

      //get sent request
      let rRegistry = await connection.getAssetRegistry(`${NS}.Request`);

      //this list would containt my sent request and received request
      let requestList = await rRegistry.getAll();

      //filter out the request list if receiver is me
      let filtered = requestList.filter(e => e.senderId == userId);
      

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
 * @param {userId, requestId, assetName, authorizeList senderId, newStatus} req
 */
  app.put('/api/updateRequestStatus', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        requestId,
        senderId,
        newStatus,
        assetName,
        authorizeList
      } = req.body;

      //connect network as user
      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }
      
      let definition = userCard.getDefinition();
      let connection = userCard.getConnection();

      //submit UpdateRequestStatus as current user
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'UpdateRequestStatus');
      transaction.requestId = requestId;
      transaction.newStatus = newStatus;

      await connection.submitTransaction(transaction);

      //authroize user access asset, if status is ACCEPT
      if (newStatus == 'ACCEPT') {
        //authorize access user profile
        if (assetName == 'User') {
          transaction = factory.newTransaction(NS, 'AuthorizeAccessProfile');
          transaction.userId = senderId;

          await connection.submitTransaction(transaction);
        }
        //authorize access asset, authorize the asset list base the assetName
        else {
          transaction = factory.newTransaction(NS, 'AuthorizeAccessSpecifyRecord');
          transaction.assetName = assetName;
          transaction.userId = senderId;
          transaction.assetId = authorizeList;

          await connection.submitTransaction(transaction);
        }
      }

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
   * @param {senderId, receiverId, eventName, remarks (optional), assetId[], assetName} req
   */
  app.post('/api/requestAccessAsset', async function(req, res) {
    try {

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      //get request param
      const {
        receiverId,
        receiverName,
        assetName,
        assetId,
        eventName,
        remarks
      } = req.body;

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      //check receiver is have asset, use network admin check
      await Network.connect();

      let connection = Network.getConnection();

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

      await Network.disconnect();


      // submit transaction as user
      let definition = userCard.getDefinition();
      connection = userCard.getConnection();

      //new transaction
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'RequestAccessAsset');
      transaction.receiverId = receiverId;
      transaction.receiverName = receiverName;
      transaction.assetName = assetName;
      transaction.assetId = requestList;
      transaction.eventName = eventName;  

      if (remarks) {
        transaction.remarks = remarks;
      }

      //submit request access asset transaction
      await connection.submitTransaction(transaction);
    
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
   * @param {userId, requestId, revokeUser, assetName, assetIds[]} req
   */
  app.post('/api/revokeAccessAsset', async function(req, res) {
    try {
      console.log('RevokeAccessAsset api start');
      
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        assetName,
        assetIds,
        revokeUser,
        requestId
      } = req.body;

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let definition = userCard.getDefinition();
      let connection = userCard.getConnection();

      //fire transaction
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'RevokeAccessSpecifyRecord');
      transaction.assetName = assetName;
      transaction.assetId = assetIds;
      transaction.userId = revokeUser;

      await connection.submitTransaction(transaction);

     //update the reuqest status from accepted to revoked
      let registry = await connection.getAssetRegistry(`${NS}.Request`);
      let request = await registry.get(requestId);
      request.status = 'REVOKED';
      await registry.update(request);


      res.status(200).json({
        result: 'Asset revoked'
      });

      console.log('RevokeAccessAsset api finish');
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

      // await userCard.connect();
      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }
      
      let connection = userCard.getConnection();

      //get all channel list
      let registry = await connection.getParticipantRegistry(`${NS}.Channel`)
      let channelList = await registry.getAll();

      //filter user belong channel
      let filtered = channelList.filter(e => e.members.includes(userId));

      //get channel's member info and replace member id with member object
      let responseList = [];
      registry = await connection.getParticipantRegistry(`${NS}.User`);

      //no use es6 syntax, async call in es6 with loop would cause inccorect flow
      for (let i=0; i<filtered.length; i++) {
        let e = filtered[i];
        let members = e.members || [];
        let membersInfo = [];

        for (let y=0; y<members.length; y++) {
          let id = members[y];
          let info = await Helper.GetUserInfo(id);
          membersInfo.push(info);
        }

        //the channel's members property are store id, and cannnot change network object defition
        //so this object list
        responseList.push({
          "channel": e,
          "membersInfo": membersInfo
        })
      }
      
      //return filtered list
      res.status(200).json({
        result: responseList
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
   * @param {userId, assetName, assetIds} req
   */
  app.get('/api/getAsset', async function(req, res) {
    try {

      console.log('getAsset api start');
      
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      let {assetName, assetIds} = req.query;

      //if string type mean no array, convert to array
      if (typeof assetIds == 'string') {
        assetIds = [assetIds];
      }

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }
      
      let connection = userCard.getConnection();

      //get asset name
      let registry = await connection.getAssetRegistry(`${NS}.${assetName}`);
      let assets = [];

      //if assetIds is empty get all asset with this asset name
      if (assetIds == undefined || assetIds.length == 0) {
        assets = await registry.getAll();
      }
      else {
        //get asset by id
        for (let i=0; i<assetIds.length; i++) {
          let id = assetIds[i];
          let asset = await registry.get(id);
          assets.push(asset);
        }
    }

      res.status(200).json({
        result: assets
      });

      console.log('get asset api finish');

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

};
