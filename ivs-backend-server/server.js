import express from 'express';
const app = express();
app.use(express.json());

import IvsNetwork from './lib/ivsnetwork.js'

const NS = 'org.example.ivsnetwork';
const Path = '/api';
const CardName = "admin@ivs-network";
const Network = new IvsNetwork(CardName);

//listene event emitted from network
Network.connection.on('event', async event => {

  //check event type 

  //if request access user's asset event

  //emit event to target user for asset request
  const eventInfo = {
    type: event.getType(),
    identifier: event.getIdentifier(),
    eventId: event.eventId,
    timestamp: event.timestamp,
    conent: event.detail,
    transaction: event.transaction
  };
  console.log('received event')
  console.log(eventInfo);

  // const definition = await Network.connect();
  // const factory = definition.getFactory();
  // const transaction = factory.newTransaction('org.example.ivsnetwork', eventInfo.transaction);
  // transaction.param = 'change';
});

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


app.get('/login', async function (req, res) {
  try {
    const network = new IvsNetwork('admin@ivs-network');
    const userInfo = await network.connect();
    res.status(200).json({result: userInfo.toString()});
  }
  catch (error) {
    res.status(500).json({error: error.toString()});
  }
})

var server = app.listen(8081, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)
})


/**
 * to check network is online
 */
app.post('/api/ping', async function (req, res) {
  try {
    //init the network
    await Network.connect();

    //ping network
    let result = await Network.ping();

    //output network info
    res.json({"user": result});
  }
  catch (error) {
    res.status(500).json({"error": error.toString()});
  }
})

/**
 * this api call will reutrn all defined asset in the business network
 */
app.get('/api/getAllRegistryAsset', async function(req, res) {
  try {
    //get all defined asset from the network
    await Network.connect();
    const connection = Network.getConnection();
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
app.get('/api/getAllRegistryParticipant', async function(req, res) {
  try {
    //get defined participant from network
    await Network.connect();
    const connection = Network.getConnection();
    const allPaticipant = await connection.getAllParticipantRegistries();
    connection.gettr

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
 * return user's received access request for asset
 * @param {userId} req
 */
app.get(`/${Path}/getAccessRequestList`, async function(req, res) {
  try {

  }
  catch (error) {
    res.status(500).json({
      error: error.toString()
    });
  }
})

/**
 * return the list of request user had sent
 * @param {userId} 
 */
app.get(`${Path}/getSentRequestList`), async function(req, res) {
  
}

/**
 * @param {senderId, receiverId, assetId[], assetName} req
 */
app.post(`${Path}/requestAccessAsset`, async function(req, res) {
  try {

    //get request param
    const {
      senderId,
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
    res.status(500).json({
      error: error.toString()
    });
  }
})



app.post('/api/eventTest', async function(req, res) {
  try {
    //get defined participant from network
    const definition = await Network.connect();
    const connection = Network.getConnection();
    
    const factory = definition.getFactory()
    const transaction = factory.newTransaction('org.example.ivsnetwork', 'TestTransaction');
    transaction.param = 'test';
    await connection.submitTransaction(transaction);

    //return the result
    res.status(200).json({
      result: 'transaction submitted'
    });
      
  }
  catch (error) {
    res.status(500).json({
      error: error.toString()
    });
  }
})


