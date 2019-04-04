
/**
 * @param {org.example.ivsnetwork.CreateRecord} createRecord - the trade to be processed
 * @transaction
 */
async function CreateRecord(createRecord) {
  /*
    record.workExp = [factory.newRelationship(namespace, 'WorkExp', 'ATG')];
    o String recordId
  o User user
  o DateTime createTime
  o Education[] educations
  o WorkExp [] workExps
  o String workSkills
  */
  var newRecordId = createRecord.recordId;
  var factory = getFactory();

  //create user
  let user = CreateUser(createRecord.user);
  
  //create education
  //let education = CreateEducation(createRecord.education);
  
  //create record
  var newRecord = factory.newResource('org.example.ivsnetwork', 'Record', newRecordId);
  newRecord.createTime = createRecord.createTime;
  newRecord.user = user;
  //newRecord.education = education;

  let assetRegistry = await getAssetRegistry('org.example.ivsnetwork.Record');

  await assetRegistry.add(newRecord);
}


/**
 * Track the trade of a commodity from one trader to another
 * @param {org.example.ivsnetwork.CreateUser} user - the trade to be processed
 * @transaction
 */
async function CreateUser(user) {
    
  let factory = getFactory();

  let newUser = factory.newResource('org.example.ivsnetwork', 'User', user.userId);
  newUser.firstName = user.firstName;
  newUser.lastName = user.lastName;
  newUser.phone = user.phone;
  newUser.email = user.email;
  newUser.location = user.location;

  let assetRegistry = await getParticipantRegistry('org.example.ivsnetwork.User');

  await assetRegistry.add(newUser);
  
}

/**
 * @param {org.example.ivsnetwork.CreateEducation} education - the trade to be processed
 * @transaction
 */
async function CreateEducation(education) {
  let factory = getFactory();

  let newEducation = factory.newResource('org.example.ivsnetwork', 'Education', education.name);
  newEducation.name = education.name;
  newEducation.major = education.major;

  let assetRegistry = await getAssetRegistry('org.example.ivsnetwork.Education');

  await assetRegistry.add(newEducation);
}

/**
 * @param {org.example.ivsnetwork.CreateWorkExp} workExp - the trade to be processed
 * @transaction
 */

async function CreateWorkExp(workExp) {
	let factory = getFactory();
  	
  	let newExp = factory.newResource('org.example.ivsnetwork', 'WorkExp', workExp.name);
  	newExp.name = workExp.name;
  	newExp.jobTitle = workExp.jobTitle;
  	newExp.jobDuty = workExp.jobDuty;
  	newExp.from = workExp.from;
  	newExp.to = workExp.to;
  
  	let assetRegistry = await getAssetRegistry('org.example.ivsnetwork.WorkExp');
  
   await assetRegistry.add(newExp);

}

