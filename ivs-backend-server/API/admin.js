import IvsNetwork from '../lib/ivsnetwork.js';
import Helper from '../helper/helper.js';
import Config from '../config/config.js';



const AdminCard = new IvsNetwork('admin@ivs-network');

module.exports = function(app, jwt, NS) {

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
  app.get('/api//admin/getAllRegistryAsset', async function(req, res) {
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


}