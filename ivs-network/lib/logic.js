const NS = 'org.example.ivsnetwork';
const Debug_Key = "@Debug";


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


/**
 * @param {org.example.ivsnetwork.AuthorizeAccess} authorize
 * @transaction
 */
async function AuthorizedAccess(authorize) {

  const factory = getFactory();

  //get response asset
  const assetName = authorize.assetName;
  const assetId = authorize.assetId;
  const assetRegistry = await getAssetRegistry(`${NS}.${assetName}`);
  const asset = await assetRegistry.get(assetId);

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

  // const currentUser = getCurrentParticipant();
  

  // if (!currentUser) throw new Error('A user not exist');

  // //authorize user access permission
  // let index = -1;
  // if (!currentUser.authorized)
  // {
  //   currentUser.authorized = []; //add property if not exist
  // }
  // else 
  // {
  //   index = currentUser.authorized.indexOf(authorize.userId);
  // }

  // //add user to authorize list
  // if (index < 0)
  // {
  //   currentUser.authorized.push(authorize.userId);

    // //emit an event
    // const event = factory.newEvent(NS, 'UserEvent');
    // event.userTransaction = authorize;
    // emit(event);

  //   //update user state
  //   const registry = await getParticipantRegistry(`${NS}.User`);
  //   await registry.update(currentUser);
  // }
}

/**
 * @param {org.example.ivsnetwork.RevokeAccess} revoke
 * @transaction
 */
async function RevokeAccess(revoke) {
  
  const factory = getFactory();
  const currentUser = getCurrentParticipant();

  if (!currentUser) throw new Error("A user not exist");

  //remove user access permission
  const index = currentUser.authorized ? currentUser.authorized.indexOf(revoke.userId) : -1;
  if (index > -1)
  {
    currentUser.authorized.splice(index, 1);

    //emit event
    const event = factory.newEvent(NS, "UserEvent");
    event.userTransaction = revoke;
    emit(event);

    //update user state
    const registry = await getParticipantRegistry(`${NS}.User`);
    await registry.update(currentUser);
  }
}