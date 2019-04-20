"use strict"

const NS = 'org.example.ivsnetwork';
const Debug_Key = "@Debug";
const allAssets = ['Education', 'Record', 'VolunteerRecord', 'WorkExp'];

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


/**
 * Track the trade of a commodity from one trader to another
 * @param {org.example.ivsnetwork.CreateUser} user - the trade to be processed
 * @transaction
 */
async function CreateUser(user) {

  let factory = getFactory();
  AddUser(factory, user.baseInfo);
}


async function AddUser(factory, data) {
  
  let newUserId = UIDGenerator('u');
  let newUser = factory.newResource(NS, 'User', newUserId);
  newUser.baseInfo = data;

  let assetRegistry = await getParticipantRegistry(`${NS}.User`);

  await assetRegistry.add(newUser);

  return newUser;
}

/**
 * @param {org.example.ivsnetwork.CreateEducation} education - the trade to be processed
 * @transaction
 */
async function CreateEducation(education) {

  let factory = getFactory();
  AddEducation(factory, education.info);
}

async function AddEducation(factory, data) {
  let newId = UIDGenerator('e');

  let newEducation = factory.newResource(NS, 'Education', newId);
  newEducation.info = data;

  //get current user, and the record own by current user
  let currentUser = getCurrentParticipant();
  newEducation.owner = factory.newRelationship(NS, 'User', currentUser.getIdentifier());

  let assetRegistry = await getAssetRegistry(`${NS}.Education`);
  await assetRegistry.add(newEducation);

  return newEducation;
}

/**
 * @param {org.example.ivsnetwork.CreateWorkExp} workExp - the trade to be processed
 * @transaction
 */
async function CreateWorkExp(workExp) {

  let factory = getFactory();
  AddWorkExp(factory, workExp.info);

}

async function AddWorkExp(factory, data) {

  let newId = UIDGenerator('c');
  let newExp = factory.newResource(NS, 'WorkExp', newId);
  newExp.info = data;

  //get current user, and the record own by current user
  let currentUser = getCurrentParticipant();
  newExp.owner = factory.newRelationship(NS, 'User', currentUser.getIdentifier());


  let assetRegistry = await getAssetRegistry(`${NS}.WorkExp`);
  await assetRegistry.add(newExp);

  return newExp;
}

/**
 * @param {org.example.ivsnetwork.CreateRecord} record - the trade to be processed
 * @transaction
 */
async function CreateRecord(record) {


  let factory = getFactory();
  let newRecordId = UIDGenerator('r');

  //create user
  // let user =  await AddUser(factory, record.userInfo);
  
  //create education info
  let educationRefs = [];
  let educationInfo = record.educationInfo || [];

  for (let i=0; i<educationInfo.length; i++) {
    let info = educationInfo[i];
    let newInfo = await AddEducation(factory, info);
    let ref = factory.newRelationship(NS, 'Education', newInfo.uid);

    educationRefs.push(ref);
  }

  //create work exp info
  let workExpRefs = [];
  let workExpInfo = record.workExpInfo || [];
  for (let i=0; i<workExpInfo.length; i++) {
    let info = workExpInfo[i];
    let newInfo = await AddWorkExp(factory, info);
    let ref = factory.newRelationship(NS, 'WorkExp', newInfo.uid);

    workExpRefs.push(ref);
  }

  
  //create record
  let newRecord = factory.newResource(NS, 'Record', newRecordId);
  newRecord.workSkills = record.workSkills;
  newRecord.createTime = record.createTime;
  newRecord.baseInfo = record.baseInfo;

    //get current user, and the record own by current user
    let currentUser = getCurrentParticipant();
    newRecord.owner = factory.newRelationship(NS, 'User', currentUser.getIdentifier());

  //reference to user
//   newRecord.user = factory.newRelationship(NS, 'User', user.userId);

  //reference education info
  newRecord.educations = educationRefs;

  //reference workExp info
  newRecord.workExps = workExpRefs;

  let assetRegistry = await getAssetRegistry(`${NS}.Record`);

  await assetRegistry.add(newRecord);

}

/**
 * @param {org.example.ivsnetwork.GetAssetById} param
 * @transaction
 */
async function GetAssetById(param) {
  
  //asset name response to the exist asset in the chain
  let assetName = param.assetName;
  let id = param.id;

  let registry = await getAssetRegistry(`${NS}.${assetName}`);
  let asset = await registry.get(id);

  return asset;
}

async function GetAsset(registry, id) {

  let asset = await registry.get(id);

  return asset;
}


/**
 * @param {org.example.ivsnetwork.AuthorizeAccessProfile} authorize
 * @transaction
 */
async function AuthorizeAccessProfile(authorize) {
  
  const me = getCurrentParticipant();
  if (!me) throw new Error('A user not exist');

  //authorize user access permission
  let index = -1;
  if (!me.authorized)
  {
    me.authorized = []; //add property if not exist
  }
  else 
  {
    index = me.authorized.indexOf(authorize.userId);
  }

  //add user to authorize list
  if (index < 0)
  {
    me.authorized.push(authorize.userId);

    //emit an event
    // const event = factory.newEvent(NS, 'UserEvent');
    // event.userTransaction = authorize;
    // emit(event);

    //update user state
    const registry = await getParticipantRegistry(`${NS}.User`);
    await registry.update(me);
  }
}

/**
 * @param {org.example.ivsnetwork.RevokeAccessProfile} revoke 
 * @transaction
 */
async function RevokeAccessProfile(revoke) {
  const me = getCurrentParticipant();

  if (!me) throw new Error("A user not exist");

  //remove user access permission
  const index = me.authorized ? me.authorized.indexOf(revoke.userId) : -1;
  if (index > -1)
  {
    me.authorized.splice(index, 1);

    // //emit event
    // const event = factory.newEvent(NS, "UserEvent");
    // event.userTransaction = revoke;
    // emit(event);

    //update user state
    const registry = await getParticipantRegistry(`${NS}.User`);
    await registry.update(me);
  }
}

/**
 * @param {org.example.ivsnetwork.AuthorizeAccessAsset} authorize
 * @transaction 
 */
async function AuthorizeAccessAsset(authorize) {
  
  //get response asset
  const assetName = authorize.assetName;
  const assetId = authorize.assetId;
  const assetRegistry = await getAssetRegistry(`${NS}.${assetName}`);
  const asset = await GetAsset(assetRegistry, assetId);

  //update asset's authorized list
  if (!asset) throw new Error ("Asset not exist");

  let index = -1;
  if (!asset.authorized)
  {
    asset.authorized = []; //init array
  }
  else 
  {
    index = asset.authorized.indexOf(authorize.userId);
  }
  //authorize user access permission
  if (index < 0)
  {
    asset.authorized.push(authorize.userId);

    // //emit an event
    // const event = factory.newEvent(NS, 'UserEvent');
    // event.userTransaction = authorize;
    // emit(event);

    //update asset state
    await assetRegistry.update(asset);
  }
}

/**
 * 
 * @param {org.example.ivsnetwork.RevokeAccessAsset} revoke 
 * @transaction
 */
async function RevokeAccessAsset(revoke) {
  //get response asset
  const assetName = revoke.assetName;
  const assetId = revoke.assetId;
  const assetRegistry = await getAssetRegistry(`${NS}.${assetName}`);
  const asset = await GetAsset(assetRegistry, assetId);

  if (!asset) throw new Error ("Asset not exist");

  //remove user access permission
  const index = asset.authorized ? asset.authorized.indexOf(revoke.userId) : -1;
  if (index > -1)
  {
    asset.authorized.splice(index, 1);
    await assetRegistry.update(asset);
  }
}


/**
 * 
 * @param {org.example.ivsnetwork.AuthorizeAccessSpecifyRecord} authorize 
 * @transaction
 */
async function AuthorizeAccessSpecifyRecord(authorize) {

  const assetName = authorize.assetName;
  const registry = await getAssetRegistry(`${NS}.${assetName}`);
  const authorizeAll = authorize.assetId.length <= 0;
  
  //if asset id param's length is < 1, perform authorize all record of this asset
  if (authorizeAll) {
    //get all asset info
    const all = await registry.getAll() || [];

    //loop for each asset to update authorize list
    for (let i=0; i<all.length; i++) {
      const currentAsset = all[i];
      const authorizeData = {
        "userId": authorize.userId,
        "assetName": assetName,
        "assetId": currentAsset.getIdentifier(),
      };
      // //emit the event
      // const event = factory.newEvent(NS, 'AuthorizeAccessEvent');
      // event.userId = authorize.userId;
      // event.assetName = assetName;
      // event.assetId = currentAsset.getIdentifier();
      // emit(event);
      //invoke aturhozeAccessAsset transaction to authorize individually
      await AuthorizeAccessAsset(authorizeData);
    }
  }
  //else perform authorize specify record
  else {
    for (let i=0; i<authorize.assetId.length; i++) {
      const assetId = authorize.assetId[i];
      const authorizeInfo = {
        "userId": authorize.userId,
        "assetName": assetName,
        "assetId": assetId
      };

      await AuthorizeAccessAsset(authorizeInfo);
    }
  }
}

/**
 * 
 * @param {org.example.ivsnetwork.RevokeAccessSpecifyRecord} revoke 
 * @transaction
 */
async function RevokeAccessSpecifyRecord(revoke) {

  const assetName = revoke.assetName;
  const registry = await getAssetRegistry(`${NS}.${assetName}`);
  const revokeAll = revoke.assetId.length <= 0;
  
  //if asset id param's length is < 1, perform revoke all record of this asset
  if (revokeAll) {
    //get all asset info
    const all = await registry.getAll() || [];

    //loop for each asset to update authorize list
    for (let i=0; i<all.length; i++) {
      const currentAsset = all[i];
      const revokeInfo = {
        "userId": revoke.userId,
        "assetName": assetName,
        "assetId": currentAsset.getIdentifier(),
      };
      // //emit the event
      // const event = factory.newEvent(NS, 'RevokeAccessEvent');
      // event.userId = authorize.userId;
      // event.assetName = assetName;
      // event.assetId = currentAsset.getIdentifier();
      // emit(event);
      //invoke aturhozeAccessAsset transaction to authorize individually
      await RevokeAccessAsset(revokeInfo);
    }
  }
  //else perform revoke specify record
  else {
    for (let i=0; i<revoke.assetId.length; i++) {
      const assetId = revoke.assetId[i];
      const revokeInfo = {
        "userId": revoke.userId,
        "assetName": assetName,
        "assetId": assetId
      };

      await RevokeAccessAsset(revokeInfo);
    }
  }
}

/**
 * @param {org.example.ivsnetwork.AuthorizeAccessAll} authorize
 * @transaction
 */
async function AuthorizeAccessAll(authorize) {

  // const factory = getFactory();
  for (let i=0; i<allAssets.length; i++) {
    const assetName =  allAssets[i];
    const authorizeInfo = {
      "userId": authorize.userId,
      "assetName": assetName,
      "assetId": []
    };

    await AuthorizeAccessSpecifyRecord(authorizeInfo);
  }

  //authorize access profile
  await AuthorizeAccessProfile({
    "userId": authorize.userId
  });
}

/**
 * @param {org.example.ivsnetwork.RevokeAccessAll} revoke
 * @transaction
 */
async function RevokeAccessAll(revoke) {
  //remove userId from each asset in business network
  for (let i=0; i<allAssets.length; i++) {
    const assetName =  allAssets[i];
    const revokeInfo = {
      "userId": revoke.userId,
      "assetName": assetName,
      "assetId": []
    };
    
    await RevokeAccessSpecifyRecord(revokeInfo);
  }

  //revoke access profile
  await RevokeAccessProfile({
    "userId": revoke.userId
  });
}

/**
 * 
 * @param {org.example.ivsnetwork.RequestAccessAsset} request
 * @transaction 
 */
async function RequestAccessAsset(request) {
  let factory = getFactory();

  //sender
  let me = getCurrentParticipant();
  if (!me) throw new Error('A user not exist')

  //create request asset and fill-up info
  let newRequestId = UIDGenerator('r');
  let rRegistry = await getAssetRegistry(`${NS}.Request`);

  let requestAsset = factory.newResource(NS, 'Request', newRequestId);
  requestAsset.senderId = me.getIdentifier();
  requestAsset.receiverId = request.receiverId;
  requestAsset.remarks = request.remarks;
  requestAsset.requested = request.assetId;
  requestAsset.status = 'UNDETERMINED'

  //upload asset to network
  await rRegistry.add(requestAsset);
}


/**
 * @param {org.example.ivsnetwork.CreateChannel} channel
 * @transaction
 */
async function CreateChannel(channel) {

  const factory = getFactory();
  const newChannelId = UIDGenerator('c');
  const me = getCurrentParticipant();

  if (!me) throw new Error("User not exist");

  //create channel
  const newChannel = factory.newResource(NS, 'Channel', newChannelId);
  newChannel.name = channel.name;
  newChannel.owner = me.getIdentifier();
  newChannel.createTime = channel.timestamp;

  const pRegistry = await getParticipantRegistry(`${NS}.User`);

  //check invite user is exit
  if (channel.members)
  {
    const members = channel.members || [];
    for (let i=0; i<members.length; i++) {
      const id = members[i];
      const user = await pRegistry.get(id);

      //if have invalid user, throw error and stop pogram
      if (!user) throw new Error('User not exist');
      
      //update user's channels data
      const userChannels = user.channels || [];
      const index = userChannels.indexOf(newChannelId);
      // join channel if not join
      if (index < 0)
      {
        userChannels.push(newChannelId);
      }
      user.channels = userChannels;

      //udpate user belonging channel 
      await pRegistry.update(user);
    }

    //add user to channel
    newChannel.members = members;
  }

  //registry the channel
  const cRegistry = await getParticipantRegistry(`${NS}.Channel`);
  await cRegistry.add(newChannel);
}

/**
 * @param {org.example.ivsnetwork.InviteChannelMember} invite
 * @transaction
 */

 async function InviteChannelMember(invite) {

  //check channel exist
  const cRegistry = await getParticipantRegistry(`${NS}.Channel`);
  const channelId = invite.channelId;
  const channel = await cRegistry.get(channelId);
  if (!channel) throw new Error('Channel not exist');

  //check user exist  
  const pRegistry = await getParticipantRegistry(`${NS}.User`);
  const users = invite.users || [];
  for (let i=0; i<users.length; i++) {
    const id = users[i];
    const user = await pRegistry.get(id);

    //if have invalid user, throw error and stop pogram
    if (!user) throw new Error('User not exist');

    //update user's channel info
    const userChannels = user.channels || [];
    const index = userChannels.indexOf(channelId);
    // join channel if not join
    if (index < 0)
    {
      userChannels.push(channelId);
    }
    user.channels = userChannels;

    //udpate user belonging channel 
    await pRegistry.update(user);

  }

  //find the user no join this channel
  const members = channel.members || [];
  const newChannelMember = [];
  for (let i=0; i<users.length; i++) {
    const index = members.indexOf(users[i]);
    if (index < 0)
    {
      newChannelMember.push(users[i]);
    }
  }

  //add user to channel
  if (newChannelMember.length > 0)
  {
    members.push(...newChannelMember);

    //update channel's member info
    channel.members = members;
    await cRegistry.update(channel);
  }
 }

 /**
  * @param {org.example.ivsnetwork.RemoveChannelMember} remove
  * @transaction
  */
 async function RemoveChannelMember(remove) {

  //check channel exist
  const cRegistry = await getParticipantRegistry(`${NS}.Channel`);
  const channelId = remove.channelId;
  const channel = await cRegistry.get(channelId);
  if (!channel) throw new Error('Channel not exist');

  //check channel member exist
  const pRegistry = await getParticipantRegistry(`${NS}.User`);
  const members = channel.members || [];

  const memberToRemove = remove.users || [];
  for (let i=0; i<memberToRemove.length; i++) {
    const userId = memberToRemove[i];
    const index = members.indexOf(userId);

      //remove channel member
    if (index > -1)
    {
      //remove the channel id from the removed channel member's channels attribute
      const user = await pRegistry.get(userId);
      const userChannels = user.channels || [];
      userChannels.splice(userChannels.indexOf(channelId), 1);
      
      //update removed user's channel info
      user.channels = userChannels;
      await pRegistry.update(user);

      //remove member from channel
      members.splice(index, 1);
    }
  }

  //update channel info
  await cRegistry.update(channel);
 }

