const NS = 'org.example.ivsnetwork';

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
  let user =  await AddUser(factory, record.userInfo);
  
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

  //reference to user
  newRecord.user = factory.newRelationship(NS, 'User', user.userId);

  //reference education info
  newRecord.educations = educationRefs;

  //reference workExp info
  newRecord.workExps = workExpRefs;

  let assetRegistry = await getAssetRegistry(`${NS}.Record`);

  await assetRegistry.add(newRecord);

}