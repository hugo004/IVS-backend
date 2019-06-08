import IvsNetwork from '../lib/ivsnetwork.js';
import Helper from '../helper/helper.js';
import Config from '../config/config.js';

const secret = Config.secret;

/**
 * generate a unique id
 * @param {*} prefix - unique id prefix
 * @param {*} length - default length 10
 */
function UIDGenerator(prefix='u', length=10) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

  return `${prefix}-${text}`;
}

const AdminCard = new IvsNetwork('admin@ivs-network');

module.exports = function(app, jwt, NS, userCardPool) {

  app.post('/api/admin/createUser', async function(req, res) {
    try{
      const {
        firstName,
        lastName,
        phone,
        email,
        location
      } = req.body;


      //connet to admin network
      let definition = await AdminCard.connect();
      let connection = AdminCard.getConnection();
      let factory = definition.getFactory();

      //create concept reference
      let baseInfo = factory.newConcept(NS, 'BaseInfo');
      baseInfo.firstName = firstName;
      baseInfo.lastName = lastName;
      baseInfo.phone = phone;
      baseInfo.email = email;
      baseInfo.location = location;

      //new transaction
      let transaction = factory.newTransaction(NS, 'CreateUser');
      transaction.baseInfo = baseInfo;

      //submit transaction to create user
      await connection.submitTransaction(transaction);
      await AdminCard.disconnect();

      res.status(200).json({
        result: 'User Created'
      });
    }
    catch (error) {
      res.status(500).json({
        error: error.toString()
      });
    }
  })


  /**
   * this api call will reutrn all defined asset in the business network
   */
  app.get('/api/admin/getAllRegistryAsset', async function(req, res) {
    try {
      //get all defined asset from the network
      await AdminCard.connect();
      const connection = AdminCard.getConnection();
      const allAsset = await connection.getAllAssetRegistries();

      //get defined asset name
      let allAssetName = [];
      allAsset.forEach(element => {
          allAssetName.push(element.id);
      });

      await AdminCard.disconnect();

      //return the result
      res.status(200).json({
        result: allAssetName
      });

    }
    catch (error) {
      res.status(500).json({
        error: error.toString()
      });
    }
  })

  /**
   * return all defined participant in network
   */
  app.get('/api/admin/getAllRegistryParticipant', async function(req, res) {
    try {
      //get defined participant from network
      await AdminCard.connect();
      const connection = AdminCard.getConnection();
      const allPaticipant = await connection.getAllParticipantRegistries();

      //get participant name
      let allPaticipantName = [];
        allPaticipant.forEach(e => {
          allPaticipantName.push(e.id);
        });

      await AdminCard.disconnect();

      //return the result
      res.status(200).json({
        result: allPaticipantName
      });
        
    }
    catch (error) {
      res.status(500).json({
        error: error.toString()
      });
    }
  })

    /**
   * @param {userId, name, owner, members[]} req
   */
  app.post('/api/admin/createChannel',  async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {
        userId,
        userName
      } = Helper.GetTokenInfo(jwt, authorization, secret);

      let {
        name,
        members
      } = req.body;

      //get defined participant from network
      let definition = await AdminCard.connect();
      let connection = AdminCard.getConnection();

      //add owner id as part of channel member
      members.push(userId);

      //submit transaction
      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'CreateChannel');
      transaction.name = name;
      transaction.members = members;
      transaction.owner = userName;
      transaction.ownerId = userId;

      await connection.submitTransaction(transaction);

      //dissconnect network
      await AdminCard.disconnect();

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
   * @param {memberIds[]} req
   */
  app.get('/api/admin/getChannelMembersAssets', async function(req, res) {
    try {
      //check user is authorized
      const {authorization} = req.headers;
      Helper.GetTokenInfo(jwt, authorization, secret);

      //get all defined asset from the network
      await AdminCard.connect();
      let connection = AdminCard.getConnection();
      const allAsset = await connection.getAllAssetRegistries();

      //get defined asset name
      let allAssetName = [];
      allAsset.forEach(element => {
          allAssetName.push(element.id);
      });

      await AdminCard.disconnect();

      //get members id
      let {memberIds} = req.query;

      //if string type mean no array, convert to array
      if (typeof memberIds == 'string') {
        memberIds = [memberIds];
      }

      let membersAsset = {};
      for (let m=0; m<memberIds.length; m++) {
        let memberId = memberIds[m];

        //connect member's network
        let memberCard = await Helper.GetUserCard(memberId);
        await memberCard.connect();

        //get member all asset of this category
        connection = memberCard.getConnection();

        let myAsset = {};
        for (let i=0; i<allAssetName.length; i++) {
          let assetName = allAssetName[i];
          let registry = await connection.getAssetRegistry(assetName);

          //put asset list to relative category
          assetName = assetName.replace(`${NS}.`, ''); //remove network namespace
          let assets = await registry.getAll();

          //filter out the asset, makesure it is belong owner
          //authorized user also can get the asset
          assets.forEach(e => {
            if (e.authorized) {
              let authorizedList = e.authorized || [];

              //if memmber access the by authorized by another user, remove it
              //to retrieve the actual asset of member
              if (authorizedList.includes(memberId)) {
                let index = assets.indexOf(e);
                if (index > -1) {
                  assets.splice(index, 1);
                }
              }
            }
          });

          myAsset[assetName] = assets;
        }

        await memberCard.disconnect();
        membersAsset[memberId] = myAsset;
      }

      res.status(200).json({
        result: membersAsset
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
   * @param {channelId, newMembers[], message}
   */
  app.post('/api/admin/sendChannelInvitation', async function(req, res) {
    try {

      const {authorization} = req.headers;
      const {userId, userName} = Helper.GetTokenInfo(jwt, authorization, secret);
      let {
        channelId,
        newMembers,
        remarks
      } = req.body;

      //if string type mean no array, convert to array
      if (typeof newMembers == 'string') {
        newMembers = [newMembers];
      }


      console.log('send channel invite api', newMembers);

      //check new members is exist
      await AdminCard.connect();
      let connection = AdminCard.getConnection();
      let pRegistry = await connection.getParticipantRegistry(`${NS}.User`);
      let aRegistry = await connection.getAssetRegistry(`${NS}.Request`);

      let definition = AdminCard.getDefinition();
      let factory = definition.getFactory();


      for (let i=0; i<newMembers.length; i++) {
        let mid = newMembers[i];
        let member = await pRegistry.get(mid);

        if (!member) {
          req.status(400).json({
            error: 'Invaited member not exist'
          });
        }

        //send invitation message to thise new members if member exist
        let newRequestId = UIDGenerator('r');

        let invation = factory.newResource(NS, 'Request', newRequestId);
        invation.requestType = 'CHANNEL';
        invation.assetName = 'User';
        invation.requestName = 'Channel Invitation';
        invation.remarks = remarks;
        invation.receiverName = `${member.baseInfo.lastName} ${member.baseInfo.firstName}`;
        invation.receiverId = member.userId;
        invation.senderId = channelId; //must use channel id, for add user to channel, if them accept
        invation.senderName = userName;
        invation.createTime = new Date();

        //add new reuqest to network
        await aRegistry.add(invation);
        
      }

      await AdminCard.disconnect();

      res.status(200).json({
        result: 'invation sent'
      });

      console.log('invite channel member api finish');

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

    /**
   * @param {userId, channelId, requestId, status} req
   * user can accept or deny channel invitation
   */
  app.put('/api/admin/updateChannelInvitationStatus', async function(req, res) {
    try {

      console.log('UpdateChannelInvitationStatus api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        channelId,
        requestId,
        status
      } = req.body;

      await AdminCard.connect();      
      let connection = AdminCard.getConnection();

      //get request and update status
      let aRegistry = await connection.getAssetRegistry(`${NS}.Request`);
      let requestAsset = await aRegistry.get(requestId);
      requestAsset.status = status;

      await aRegistry.update(requestAsset);

      //not continue process if denied
      if (status == 'ACCEPT') {
  
        //if user accept, put user into channel
        let pRegistry = await connection.getParticipantRegistry(`${NS}.Channel`);
        let channel = await pRegistry.get(channelId);

        //check member is already join the channel
        let members = channel.members || [];
        if (members.includes(userId)) {
          res.status(400).json({
            error: 'User already join this channel'
          });
        }
        
        //update channel's members info
        members.push(userId);
        channel.members = members;
        await pRegistry.update(channel);

        //update the user's channel info
        pRegistry = await connection.getParticipantRegistry(`${NS}.User`);
        let me = await pRegistry.get(userId);

        let myChannels = me.channels || [];
        myChannels.push(channelId);
        me.channels = myChannels
        await pRegistry.update(me);
    }

      await AdminCard.disconnect();

      console.log('UpdateChannelInvitationStatus api finish');

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
   * @param {userId, channelId} req
   */
  app.put('/api/admin/exitChannel', async function(req, res) {
    try {
      console.log('exitChannel API start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      const {
        channelId,
        removeMebers
      } = req.body;

      await AdminCard.connect();
      let connection = AdminCard.getConnection();

      //get channel and remove user from members property
      let pRegistry = await connection.getParticipantRegistry(`${NS}.Channel`);
      let channel = await pRegistry.get(channelId);
      let members = channel.members || [];

      //remove member from channels
      if (members.includes(userId)) {
        let index = members.indexOf(userId);
        if (index > -1) {
          members.splice(index, 1);
        }

        channel.members = members;
        await pRegistry.update(channel);
      }


      //get user info and remove channel from channels property
      pRegistry = await connection.getParticipantRegistry(`${NS}.User`);
      let me = await pRegistry.get(userId);
      let myChannels = me.channels || [];

      //remove channel from user
      if (myChannels.includes(channelId)) {
        let index = myChannels.indexOf(channelId);
        if (index > -1) {
          myChannels.splice(index, 1);
        }

        me.channels = myChannels;
        await pRegistry.update(me);
      }

      await AdminCard.disconnect();

      res.status(200).json({
        result: 'Exit success'
      });

      console.log('exitChannel API finish');
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

}