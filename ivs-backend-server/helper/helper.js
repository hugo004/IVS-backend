import IvsNetwork from '../lib/ivsnetwork.js';


const NS = 'org.example.ivsnetwork';
const AdminCard = "admin@ivs-network";
const Network = new IvsNetwork(AdminCard);

module.exports = {
  GetUserCard: async function (userId, pswd='') {
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
    
    if (filtered.length < 1) throw Error ('User no ID card');
    
    await Network.disconnect();

    //switch to user profile from admin, create asset or submit transaction as user ID
    let identity = filtered[0];
    let userCard = new IvsNetwork(`${identity.name}@ivs-network`);

    return userCard;
  },
  
  getParticipantRegistry: async function(assetName) {

  },
};