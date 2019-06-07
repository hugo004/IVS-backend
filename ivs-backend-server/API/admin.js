import IvsNetwork from '../lib/ivsnetwork.js';
import Helper from '../helper/helper.js';
import Config from '../config/config.js';



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
      } = Helper.GetTokenInfo(jwt, authorization, Config.secret);

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
      console.log(memberIds);
      console.log(typeof memberIds);

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

}