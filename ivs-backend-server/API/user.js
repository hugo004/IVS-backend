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
  app.post('/api/verifierLogin', async function (req, res) {
    try {

      const {
        userName,
        password
      } = req.body;

      let userId = await Helper.GetUserId(userName, password);
      let userCard = await Helper.GetUserCard(userId);
      if (!userCard) throw new Error('user name or password not correct');

      let userInfo = await Helper.GetUserInfo(userId, 'Verifier');

      //generate token
      let payload = {
        userId: userId,
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

      console.log('GetAccessRequestList api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      let {status} = req.query;

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let connection = userCard.getConnection();

      //if string type mean no array, convert to array
      if (typeof status == 'string') {
        status = [status];
      }

      //check new status is within status type
      let statusTypes = ['UNDETERMINED', 'ACCEPT', 'DENY', 'REVOKED', 'GRANT', 'OTHER'];
      let filterStatus = [];

      //add filter status
      status.forEach(e => {
        if (statusTypes.includes(e)) {
          filterStatus.push(e);
        }
      });

      //default all
      if (filterStatus.length < 1) {
        filterStatus = ['ALL'];
      }

      console.log(filterStatus);
      //get received request
      let rRegistry = await connection.getAssetRegistry(`${NS}.Request`);

      //this list would containt my sent request and received request
      let requestList = await rRegistry.getAll();


      //filter out the request list if receiver is me
      let filtered = requestList.filter(e => e.receiverId == userId);


      //filter out the request list by status (UNDETERMINED / DENY / ACCEPT), default return all status
      if (!filterStatus.includes('ALL')) {
        filtered = filtered.filter(e => filterStatus.includes(e.status));
      }

      //return my request list
      res.status(200).json({
        result: filtered
      });

      console.log('GetAccessRequestList api finish');

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
   * @param {userId, status} 
   */
  app.get('/api/getSentRequestList', async function(req, res) {
    try {
      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      let {status} = req.query;

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      //if string type mean no array, convert to array
      if (typeof status == 'string') {
        status = [status];
      }

      //check new status is within status type
      let statusTypes = ['UNDETERMINED', 'ACCEPT', 'DENY', 'REVOKED', 'GRANT', 'OTHER'];
      let filterStatus = [];

      //add filter status
      status.forEach(e => {
        if (statusTypes.includes(e)) {
          filterStatus.push(e);
        }
      });

      //default all
      if (filterStatus.length < 1) {
        filterStatus = ['ALL'];
      }

      let connection = userCard.getConnection();

      //get sent request
      let rRegistry = await connection.getAssetRegistry(`${NS}.Request`);

      //this list would containt my sent request and received request
      let requestList = await rRegistry.getAll();

      //filter out the request list if receiver is me
      let filtered = requestList.filter(e => e.senderId == userId);
      
      if (!filterStatus.includes('ALL')) {
        filtered = filtered.filter(e => filterStatus.includes(e.status));
      }

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

      console.log('requestAccessAsset api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      //get request param
      const {
        receiverId,
        receiverName,
        assetName,
        assetId,
        eventName,
        remarks,
        status
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
        
        let ownerId  = targetAsset.owner;
        //if grant record action
        if (status == 'GRANT') {
          if (!(ownerId == userId)) throw new Error (`Asset Id: ${targetAsset.getIdentifier()} not own by you`);
        }
        else {
          //check the requested asset is own by receiver
          if (!(ownerId == receiverId)) throw new Error (`Asset Id: ${targetAsset.getIdentifier()} not own by receiver`);
        }
        requestList.push(id);
      };

      await Network.disconnect();


      // submit transaction as user
      let definition = userCard.getDefinition();
      connection = userCard.getConnection();

      //new transaction
      let factory = definition.getFactory();

      //divie to single request, if requested asset more than one
      // for the revoke action purpose
      for (let i=0; i<requestList.length; i++) {
        let assetId = [requestList[i]];

        let transaction = factory.newTransaction(NS, 'RequestAccessAsset');
        transaction.receiverId = receiverId;
        transaction.receiverName = receiverName;
        transaction.assetName = assetName;
        transaction.assetId = assetId;
        transaction.eventName = eventName;  

        if (remarks) {
          transaction.remarks = remarks;
        }

        if (status) {
          transaction.status = status;
        }

        //submit request access asset transaction
        await connection.submitTransaction(transaction);
    }
    
      res.status(200).json({
        result: 'Reqeust sent'
      });

      console.log('requestAccessAsset api finish');

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
      console.log('getUserChannel api start');

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

      console.log('getUserChannel api finish');

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

  /**
   * @param {userId, educations[], workExps[], volunteerRecords[]}
   */
  app.post('/api/uploadRecord', async function(req, res) {
    try {
      console.log('uploadRecord api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      const {educations, workExps, volunteerRecords} = req.body;

      let definition = userCard.getDefinition();
      let connection = userCard.getConnection();
      let factory = definition.getFactory();

      //create education record
      for (let i=0; i<educations.length; i++) {
        let education = educations[i];
        const {school, major, from, to, gpa} = education;
        
        let eduInfo = factory.newConcept(NS, 'EducationInfo');
        eduInfo.school = school;
        eduInfo.major = major;
        eduInfo.from = new Date(from),
        eduInfo.to = new Date(to);
        eduInfo.gpa = Number(gpa);

        let eduTransction = factory.newTransaction(NS, 'CreateEducation');
        eduTransction.info = eduInfo;
        await connection.submitTransaction(eduTransction);
      }

      //create workExp record
      for (let i=0; i<workExps.length; i++) {
        let workExp = workExps[i];
        const {company, jobTitle, jobDuty, from, to} = workExp;

        let workExpInfo = factory.newConcept(NS,  'WorkExpInfo');
        workExpInfo.company = company;
        workExpInfo.jobTitle = jobTitle;
        workExpInfo.jobDuty = jobDuty;
        workExpInfo.from = new Date(from);
        workExpInfo.to = new Date(to);

        let workExpTransaction = factory.newTransaction(NS, 'CreateWorkExp');
        workExpTransaction.info = workExpInfo;
        await connection.submitTransaction(workExpTransaction);
      }

      //create volunteer record
      for (let i=0; i<volunteerRecords.length; i++) {
        let volunteerRecord = volunteerRecords[i];
        const {taskDescription, organization, hoursWorked, date, name} = volunteerRecord;

        let volunteerInfo = factory.newConcept(NS, 'VolunteerRecordInfo');
        volunteerInfo.organization = organization;
        volunteerInfo.taskDescription = taskDescription;
        volunteerInfo.hoursWorked = Number(hoursWorked);
        volunteerInfo.from = new Date(date);
        volunteerInfo.to = new Date(date);

        let volunteerRecordTransaction = factory.newTransaction(NS, 'CreateVolunteerRecord');
        volunteerRecordTransaction.info = volunteerInfo;
        volunteerRecordTransaction.name = name
        await connection.submitTransaction(volunteerRecordTransaction);
      }

      res.status(200).json({
        result: 'created'
      });

      console.log('uploadRecord api finish');
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  app.get('/api/getHistory', async function(req, res){
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
      let historian = await connection.getHistorian();
      let history = await historian.getAll();

      res.status(200).json({
        result: history
      });
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  app.get('/api/getProfile', async function(req, res) {
    try {
      console.log('getProfile api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let connection = userCard.getConnection();

      let registry = await connection.getParticipantRegistry(`${NS}.User`);
      let me = await registry.get(userId);

      //decrepted
      // //get education asset
      // registry = await connection.getAssetRegistry(`${NS}.Education`);
      // let educationsId = me.educations || [];
      // let educations = [];

      // for (let i=0; i<educationsId.length; i++) {
      //   let id = educationsId[i];
      //   let education = await registry.get(id);

      //   educations.push(education);
      // }

      // //get work exp asset
      // registry = await connection.getAssetRegistry(`${NS}.WorkExp`);
      // let workExpsId = me.workExps || [];
      // let workExps = [];

      // for (let i=0; i<workExpsId.length; i++) {
      //   let id = workExpsId[i];
      //   let workExp = await registry.get(id);

      //   workExps.push(workExp);
      // }

      // //get vonlunteer record asset
      // registry = await connection.getAssetRegistry(`${NS}.VolunteerRecord`);
      // let volunteerRecordId = me.volunteerRecord || [];
      // let volRecords = [];
      
      // for (let i=0; i<volunteerRecordId.length; i++) {
      //   let id = volunteerRecordId[i];
      //   let record = await registry.get(id);

      //   volRecords.push(record);
      // }

      // //get record asset
      // registry = await connection.getAssetRegistry(`${NS}.Record`);
      // let recordsId = me.records || [];
      // let records = [];
      
      // for (let i=0; i<recordsId.length; i++) {
      //   let id = recordsId[i];
      //   let record = await registry.get(id);

      //   records.push(record);
      // }


      

      // let userInfo = {
      //   // info: me.baseInfo,
      //   Education: educations,
      //   WorkExp: workExps,
      //   VolunteerRecord: volRecords,
      //   Record: records
      // };

      //get record asset
      registry = await connection.getAssetRegistry(`${NS}.Record`);
      let recordsId = me.records || [];
      let records = [];
      
      for (let i=0; i<recordsId.length; i++) {
        let id = recordsId[i];
        let record = await registry.get(id);

        //only verify record
        if (record.isVerify)
          records.push(record);
      }

      let userInfo = {
        Record: records
      };


      res.status(200).json({
        result: userInfo
      });

      console.log('getProfile api finish');
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  }),

  /**
   * @param {records, name} req
   */
  app.post('/api/UploadRecordFiles', async function(req, res) {
    try {
      console.log('uploadRecordFile api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }


      let {recordType} = req.body;

      //get the file
      let file = req.files.records;

      //upload the base64 string to network
      let {data, mimetype, name} = file;
      let base64Str =  Helper.getBase64(data);

      //submit transaction
      let definition = userCard.getDefinition();
      let connection = userCard.getConnection();

      let factory = definition.getFactory();
      let transaction = factory.newTransaction(NS, 'CreateRecord');
      transaction.name = name;
      transaction.encrypted = base64Str;
      transaction.fileType = mimetype;
      transaction.recordType = recordType;

      await connection.submitTransaction(transaction);

      res.status(200).json({
        result: 'success'
      });

      console.log('uploadRecordFile api finish');
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })



  /**
   * @param {isVerify, verifierType} req
   */
  app.get('/api/getVerifyRecord', async function (req, res) {
    try {
      console.log('getVerifyRecord api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }
      
      const {isVerify} = req.query;

      let connection = userCard.getConnection();
      let registry = await connection.getAssetRegistry(`${NS}.Record`);

      let records = await registry.getAll();

      let filtered = records;

      if (typeof isVerify == 'boolean') {
        filtered = filtered.filter(e => e.isVerify == isVerify);
      }

      let recordList = [];
      let pRegistry = await connection.getParticipantRegistry(`${NS}.User`);
      
      for (let i=0; i<filtered.length; i++) {
        let record = filtered[i];
        let owner = await pRegistry.get(record.owner);
        
        //clone the object, replace owner id with object
        const {assetId, createTime, encrypted, fileType, isVerify, name} = record;
        recordList.push({
          'assetId': assetId,
          'creatTime': createTime,
          'encrypted': encrypted,
          'fileType': fileType,
          'isVerify': isVerify,
          'name': name,
          'owner': owner
        });
      }

      res.status(200).json({
        result: recordList
      });

      console.log('getVerifyRecord api finish');
    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })

  /**
   * @param {recordId, recordName, isVerify, ownerId, ownerName} req
   */
  app.put('/api/verifyRecord', async function (req, res) {
    try {
      console.log('verifyRecord api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret);
      let {isVerify, recordId, recordName, ownerId, ownerName} = req.body;

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let definition = userCard.getDefinition();
      let connection = userCard.getConnection();
      let factory = definition.getFactory();

      let transaction = factory.newTransaction(NS, 'VerifyRecord');
      transaction.recordId = recordId;
      transaction.isVerify = isVerify;

      await connection.submitTransaction(transaction);

      //send notification
      transaction = factory.newTransaction(NS, 'RequestAccessAsset');
      transaction.receiverId = ownerId;
      transaction.receiverName = ownerName;
      transaction.assetName = recordName;
      transaction.assetId = [recordId];
      transaction.eventName = 'Record Verification';  
      transaction.remarks = 'Your record was verified';
      transaction.status = 'OTHER';

      await connection.submitTransaction(transaction);

      res.status(200).json({
        result: 'Record Verified'
      });

      console.log('verifyRecord api finish');

    }
    catch (error) {
      let statusCode = Helper.ErrorCode(error);
      res.status(statusCode).json({
        error: error.toString()
      });
    }
  })


  /**
   * @param {userId}
   * return user list in network, exclude the current user
   */
  app.get('/api/getUsers', async function(req, res) {
    try {
      console.log('getUser api start');

      const {authorization} = req.headers;
      const {userId} = Helper.GetTokenInfo(jwt, authorization, secret)

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      let connection = userCard.getConnection();
      let registry = await connection.getParticipantRegistry(`${NS}.User`);
      let allUsers = await registry.getAll();

      //filter out me from user list
      let filtered = allUsers.filter(e => e.userId != userId);


      res.status(200).json({
        result: filtered
      });

      console.log('getUser api finish');
      
    }
    catch (error) {
      res.status(500).json({
        error: error
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

      let userCard = userCardPool.get(userId);
      if (!userCard) {
        res.status(401).json({
          error: 'user card not found, please login again'
        });
      }

      //get defined participant from network
      let definition = userCard.getDefinition();
      let connection = userCard.getConnection();

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

};
