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

const fileUpload = require('express-fileupload');
app.use(fileUpload());
// const EventEmitter = require('events')
// EventEmitter.defaultMaxListeners = 10;

// let emitter = new EventEmitter();
// emitter.setMaxListeners(100);



require('events').EventEmitter.defaultMaxListeners = 100;


app.get('/', function (req, res) {
  res.send('IVS Server Running')
})

var server = app.listen(8081, '0.0.0.0', function () {
  var host = server.address().address
  var port = server.address().port
  
  console.log("Example app listening at http://%s:%s %s", host, port, process.env.NODE_ENV)
})
const jwt = require('jsonwebtoken');
const userCardPool = new Map();


require('./API/admin.js')(app, jwt, NS, userCardPool);
require('./API/user.js')(app, jwt, NS, userCardPool);




