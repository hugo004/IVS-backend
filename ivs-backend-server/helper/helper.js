import IvsNetwork from '../lib/ivsnetwork.js';


const NS = 'org.example.ivsnetwork';
const AdminCard = "admin@ivs-network";
const Network = new IvsNetwork(AdminCard);

module.exports = {
  GetUserCard: async function (userId) {
    //conenct to admin networkd
    await Network.connect();
    let connection = Network.getConnection();
    let pRegistry = await connection.getParticipantRegistry(`${NS}.User`);

    //check user is exit
    let user = await pRegistry.get(userId);
    if (!user) throw new Error('User not exit');
    
    //check password is correct

    //get user networkd id card
    let iRegistry = await connection.getIdentityRegistry();
    let identities = await iRegistry.getAll();
    let filtered = identities.filter(identity => userId == identity.participant.getIdentifier());
    
    if (filtered.length < 1) throw new Error ('User no ID card');
    
    await Network.disconnect();

    //switch to user profile from admin, create asset or submit transaction as user ID
    let identity = filtered[0];
    let userCard = new IvsNetwork(`${identity.name}@ivs-network`);

    return userCard;
  },

  GetUserId: async function (userName, pswd) {
    //conenct to admin networkd
    await Network.connect();
    let connection = Network.getConnection();

    //check user name is correct
    let iRegistry = await connection.getIdentityRegistry();
    let identities = await iRegistry.getAll();
    let filtered = identities.filter(identity => userName == identity.name);
    
    if (filtered.length < 1) throw new Error('User name no correct');

    //check password is correct
    let identify = filtered[0];
    let userId = identify.participant.getIdentifier();
    let pRegistry = await connection.getParticipantRegistry(`${NS}.User`);
    let userInfo = await pRegistry.get(userId);

    // if (userInfo.password != pswd) throw new Error ('Password no correct');

    await Network.disconnect();

    //return user id
    return userId;
  },

  GetTokenInfo: function (jwt, token, secret) {
    if (token.startsWith('Bearer ')) {
      // Remove Bearer from string
      token = token.slice(7, token.length);
    }


    let payload = jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        throw err;
      }
      return decoded.payload;
    });

    return payload;
  },

  ErrorCode: function(error) {
    let statusCode = 500;
    if (error.name ){
      if (
          error.name == 'JsonWebTokenError' ||
          error.name == 'TokenExpiredError'
        ) {
        statusCode = 401;
      }
  }

    return statusCode;
  },

  GetUserInfo: async function(userId) {
    //conenct to admin networkd
    await Network.connect();
    let connection = Network.getConnection();
    let pRegistry = await connection.getParticipantRegistry(`${NS}.User`);

    //check user is exit
    let user = await pRegistry.get(userId);
    if (!user) throw new Error('User not exit');

    await Network.disconnect();
    return user;
  }
};