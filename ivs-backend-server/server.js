import express from 'express';
import IvsNetwork from './lib/ivsnetwork.js';
import Helper from './helper/helper.js';
//network basic info
const NS = 'org.example.ivsnetwork';
const Path = '/api';
const CardName = "admin@ivs-network";
const Network = new IvsNetwork(CardName);

//activate server port
const app = express();
app.use(express.json());

import cors from 'cors';
app.use(cors());

// const EventEmitter = require('events')
// EventEmitter.defaultMaxListeners = 10;

// let emitter = new EventEmitter();`
// emitter.setMaxListeners(20);

require('events').EventEmitter.defaultMaxListeners = 30


var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  
  console.log("Example app listening at http://%s:%s", host, port)
})
const jwt = require('jsonwebtoken');

require('./API/admin.js')(app, jwt, NS);
require('./API/user.js')(app, jwt, NS);


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


