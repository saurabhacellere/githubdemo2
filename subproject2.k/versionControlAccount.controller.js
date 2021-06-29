import * as cf from './../../../utils/common-functions';
import request from 'request';
import gammaConfig from './../../../core/config';
import _ from 'underscore';
import _lodash from 'lodash';
import log from '../../../utils/logger';
import { deleteRepository } from './../../../services/repository';
const errors = require('throw.js');
const GET_VCA_REPO_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/scm/getRepositoryList`;
const VALIDATE_VCA_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/scm/validateOAuthToken`;


const IDMAP = {
    "account_id": "accountId",
    "id": "accountId",
    "account_name": "accountName",
    "name": "accountName",
    "account_type": "accountType",
    "master_repository_url":"masterRepositoryUrl",
    "user_name": "userName",
    "is_deleted": "isDeleted",
    "tenant_id":"tenantId",
    "master_repository_type_id":"masterRepositoryTypeId",
    "additional_details":"additionalDetails",
    "type_name":"accountType",
    "vca_type":"vcaType"
}

export async function index(req,res,next){
    let sqlQuery = `select master_repository_details.id as account_id,master_repository_details.name as account_name,master_repository_types.type_name as account_type from master_repository_details,master_repository_types where master_repository_details.master_repository_type_id = master_repository_types.id and master_repository_details.tenant_id = $1 order by master_repository_details.id`;
    let responseArr = [];
    return req.gamma.query(sqlQuery, [req.session.tenant_id],next)
        .then(result => {
            for (let i in result){
                let reNameObj = reNamekey(result[i]);
                responseArr.push(reNameObj);
            }
            res.json(responseArr);
        });
}

export async function show(req, res, next) {
    getVcaDetails(req, next)
    .then(vcaAccount => {
        res.status(200).json(vcaAccount);
    })
    .catch(error => {
        return next(error);
    });
}

export async function create(req, res, next) {
    let { accountName, accountTypeName, accountUrl, pat, userName, serverType} = req.body;
    let password;
    accountTypeName = accountTypeName.toLowerCase();

    if(accountTypeName != "" && pat !="" ) {
        if (accountTypeName == "github") {
            userName = ((userName == '')|| (userName == undefined)) ? '' : cf.encryptStringWithAES(pat);
        }
        else {
            userName = (userName == '') ? '' : cf.encryptStringWithAES(userName);
        }
        password = (pat == '') ? '' : cf.encryptStringWithAES(pat);
    }
    else {
        return next(new errors.BadRequest(null, 1000));
    }
    accountUrl = _lodash.trim(accountUrl,'/') + '/';
    let additionalDetails = null;
    let vcaType = (accountTypeName == "bitbucket")? serverType : "";
    if(accountTypeName == "bitbucket")
    {
        additionalDetails = {
            account_type : vcaType
        }
    }
    let scmDTO = {
        "repoDTO": {
            "userName": userName,
            "password": password,
            "repositoryURL": accountUrl,
            "repositoryType": (accountTypeName == "github") ? "GIT" : "BIT",
            "vcaType": vcaType
        }
    };
    isDuplicateAccount(req, false, 0, userName, password, accountName, next)
    .then(()=>{
        return validateVCACredentials(scmDTO)
        .then(() => {
            return insertVCADetails(req, next, accountName, accountUrl, userName, password, accountTypeName, additionalDetails)
            .then(addedVCA=>{
                res.status(201).json({
                    status: 'success',
                    'accountId': addedVCA[0].id,
                    message: 'Version control account added successfully.',
                    details: 'Version control account added successfully.'
                });
            })
        })
    })
    .catch(error=>{
        return next(error);
    });
}

export async function update(req, res, next) {
    let { accountName, accountTypeName, accountUrl, userName, pat, serverType } = req.body;
    let password;

    accountId = req.params.accountId;
    accountName = cf.parseString(accountName);

    if (((accountTypeName).toLowerCase() == "github")) {
        userName = (userName == '') ? '' : cf.encryptStringWithAES(pat);
    }
    else {
        userName = (userName == '') ? '' : cf.encryptStringWithAES(userName);
    }
    password = (req.body.password == '') ? '' : cf.encryptStringWithAES(pat);


    accountUrl = _lodash.trim(accountUrl,'/') + '/';
    let additionalDetails = null;
    let vcaType = (accountTypeName == "bitbucket")? serverType : "";
    if(accountTypeName == "bitbucket")
    {
        additionalDetails = {
            account_type : vcaType
        }
    }

    let scmDTO = {
        "repoDTO": {
            "userName": userName,
            "password": password,
            "repositoryURL": accountUrl,
            "repositoryType": ((accountTypeName).toLowerCase() == "github") ? "GIT" : "BIT",
            "vcaType": vcaType
        }
    };
    isDuplicateAccount(req, true, accountId, userName, password, accountName, next)
    .then(()=>{
        return validateVCACredentials(scmDTO)
        .then(() => {
            return updateVCADetails(req, next, accountId, accountName, accountUrl, userName, password, accountTypeName,additionalDetails)
            .then(()=>{
                res.status(200).json({
                    status: 'success',
                    message: 'Version control account updated successfully.',
                    details: 'Version control account updated successfully.'
                });
            })
        })
    })
    .catch(error=>{
        return next(error);
    });
}

function isDuplicateAccount(req, isUpdate, accountId, userName, password, accountName, next) {
    let parameters = [];
    if (isUpdate) {
        sqlQuery = `select * from master_repository_details where (lower(name)= $1 and tenant_id = $2 and id != $5) or (user_name = $3 and password = $4 and tenant_id = $2 and id != $5)`;
        parameters = [accountName.toLowerCase(), req.session.tenant_id, userName, password, accountId];
    } else {
        sqlQuery = `select * from master_repository_details where (lower(name)= $1 and tenant_id = $2) or (user_name = $3 and password = $4 and tenant_id = $2)`;
        parameters = [accountName.toLowerCase(), req.session.tenant_id, userName, password]
    }
    return req.gamma.query(sqlQuery, parameters, next)
        .then(result => {
            return new Promise((resolve, reject) => {
                if (!result || result.length == 0) {
                    resolve(result);
                } else {
                    reject(new errors.CustomError("DuplicareAccountError", "Duplicate version control account", 400, 1029));
                }
            });
        })
}

function getVcaDetails(req, next) {
    let sqlQuery = `select msd.id,msd.name,msd.user_name,master_repository_types.type_name,msd.master_repository_url as url,coalesce(msd.additional_details->>'account_type','') as vca_type from master_repository_details as msd, master_repository_types where msd.id = $1 and msd.master_repository_type_id = master_repository_types.id and msd.tenant_id=$2`;
    //let responseArr = [];
    return req.gamma.query(sqlQuery, [req.params.accountId,req.session.tenant_id], next)
    .then(result => {
        return new Promise((resolve, reject) => {
            if (!result || result.length == 0) {
                reject(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            } else {
                result[0].user_name = (result[0].user_name == '') ? '' : cf.decryptStringWithAES(result[0].user_name);
                //result[0].password = cf.decryptStringWithAES(result[0].password);
                let reNameObj = reNamekey(result[0]);
                //responseArr.push(reNameObj);
                resolve(reNameObj);
            }
        });
    });
}

function validateVCACredentials(scmDTO) {
    log.info("VALIDATING CREDENTIALS OF VCA");
    return new Promise((resolve, reject) => {
        request({
            url: `${VALIDATE_VCA_URL}`,
            method: 'POST',
            timeout: 50000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false,
            //Lets post the following key/values as form
            json: scmDTO
        }, function (error, response, body) {
            if (error) {
                log.error(error);
                if (error.message == 'ESOCKETTIMEDOUT') {
                    reject(new errors.GatewayTimeout(null, 1022));
                } else {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                }
            } else {
                if (response.statusCode == 200) {
                    log.info("VCA CREDENTIALS VALIDATED")
                    resolve(body);
                } else if (response.statusCode == 500) {
                    reject(new errors.CustomError("InvalidRepositoryCredentials", "Invalid repository credentials. Check entered url, username or password.", 400, 1200));
                } else {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                }
            }
        });
    });
}

function insertVCADetails(req, next, accountName, accountUrl, userName, password, accountTypeName, additionalDetails) {
    let accountInsertQuery = `insert into master_repository_details(name,master_repository_url,user_name,password,tenant_id,master_repository_type_id,additional_details)
                                values($1, $2, $3, $4, $5, (select id from master_repository_types where lower(type_name) = $6), $7) returning id
                                `;
    return req.gamma.query(accountInsertQuery, [accountName, accountUrl, userName, password, req.session.tenant_id, accountTypeName, additionalDetails], next)
    .then(result => {
        return result;
    });
}

function updateVCADetails(req, next, accountId, accountName, accountUrl, userName, password, accountTypeName, additionalDetails) {
    let tenantId = req.session.tenant_id;
    let sqlQuery = `DO $$
                    BEGIN
                    update master_repository_details set name = '${accountName}', master_repository_url = '${accountUrl}',user_name = '${userName}', password = '${password}' ,
                    master_repository_type_id = (select id from master_repository_types where lower(type_name) = '${accountTypeName.toLowerCase()}'), additional_details = '${additionalDetails}'
                    where id = ${accountId} and tenant_id = ${tenantId};
                    update subsystems set subsystem_repository_user_name = '${userName}', subsystem_repository_password = '${password}' where master_repository_id = ${accountId} and tenant_id = ${tenantId};
                    END;
                    $$ `;
    return req.gamma.query(sqlQuery, [], next)
    .then(result => {
        return new Promise(function (resolve, reject) {
            resolve(result);
        })
    });
}
export async function destroy(req, res, next) {
    existsVca(req,next).then(function(vcaAccount){
        if (!vcaAccount || vcaAccount.length == 0) {
            return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
        }
        else {
            deleteAssociateRepos(req,res,next).then(function(associatedRepos){
                let versionControlAccountId = req.params.accountId;
                let sqlQuery = `delete from master_repository_details where id = $1 and tenant_id= $2`;
                return req.gamma.query(sqlQuery, [versionControlAccountId,req.session.tenant_id],next)
                .then(result => {
                    res.send(200, { status: 'success', message: 'Account deleted successfully.', details: 'Account deleted successfully.' });
                });
            });
        }
    })
    .catch(error=>{
        return next(error);
    });
}

function deleteAssociateRepos(req,res,next){
    let query = `select subs.subsystem_uid from master_repository_details mrd
                    inner join subsystems subs on subs.master_repository_id=mrd.id
                    where mrd.id=$1 and mrd.tenant_id = $2`;
    return req.gamma.query(query,[req.params.accountId,req.session.tenant_id],next)
    .then(subsystemUid =>{
        return new Promise(function(resolve,reject){
            if(subsystemUid.length !== 0){
                for(let uid in subsystemUid){
                    deleteRepository(req.session.tenant_id, req.session.tenant_uid, subsystemUid[uid].subsystem_uid, next);
                }
            }
            resolve();
        })
    });
}

// function deleteVersionCtrlAccount(req,res,next){
//     let versionControlAccountId = req.params.accountId;
//     let sql = `delete from master_repository_details where id = $1 and tenant_id= $2`;
//     return req.gamma.query(sql, [versionControlAccountId,req.session.tenant_id],next)
//     .then(result => {
//         return new Promise(function(resolve,reject){
//             resolve(result);
//         })
//     })
//     .catch(error=>{
//         return next(error);
//     });
// }

export async function getRepositoryData(req, res, next) {
    var {accountType} = req.query;
    if (accountType.toLowerCase() == 'git' || accountType.toLowerCase() == 'github' || accountType.toLowerCase() == 'bitbucket') {
        return getGITRepositoryData(req, next)
        .then(repos=>{
            if (!repos || repos.length == 0) {
                return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            }
            else {
                res.status(200).json(repos);
            }
        })
    }
}

function getGITRepositoryData(req, next) {
    let repoType;
    let sqlQuery = `select mrd.master_repository_url, mrd.user_name, mrd.password,mrt.type_name from master_repository_details mrd,
                    master_repository_types mrt where mrd.id = $1 and mrd.master_repository_type_id=mrt.id and mrd.tenant_id = $2`;
    return req.gamma.query(sqlQuery, [req.params.accountId,req.session.tenant_id], next)
    .then(repoData => {
        if(repoData.length) {
            repoType = (repoData[0].type_name == 'Github') ? 'GIT' : 'BIT';
            let scmDTO = {
                "repoDTO": {
                    "userName": (repoData[0].user_name == null || repoData[0].user_name == undefined || repoData[0].user_name == '') ? '' : repoData[0].user_name,
                    "password": (repoData[0].password == null || repoData[0].password == undefined || repoData[0].password == '') ? '' : repoData[0].password,
                    "repositoryURL": repoData[0].master_repository_url,
                    "repositoryType": repoType
                }
            };
            return validateVCACredentials(scmDTO)
            .then((body)=>{
                return getData(scmDTO)
                .then(result => {
                    return(result);
                })
            });
        }
    });
}

function getData(scmDTO) {
    let repos = [], repoNameArray = [];
    return new Promise((resolve, reject)=>{
        request({
            url: `${GET_VCA_REPO_URL}`,
            method: 'POST',
            timeout: 50000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false,
            //Lets post the following key/values as form
            json: scmDTO
        }, function (error, response, body) {
            if (error) {
                log.error(error);
                if (error.message == 'ESOCKETTIMEDOUT') {
                    reject(new errors.GatewayTimeout(null, 1022));
                } else {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                }
            } else {
                if (response.statusCode == 200) {
                    if (body && !_.isEmpty(body)) {
                        let dataArray = body.split(',');
                        dataArray.forEach(d => {
                            repoNameArray = d.split('/');
                            repos.push({
                                'repoName': repoNameArray[repoNameArray.length - 1],
                                'repoUrl': d
                            });
                        });
                        resolve(repos);
                    }
                } else if (response.statusCode == 500) {
                    reject(new errors.CustomError("InvalidRepositoryCredentials", "Invalid repository credentials. Check entered url, username or password.", 400, 1200));
                } else {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                }
            }
        });
    });
    /* if (body && !_.isEmpty(body)) {
        let dataArray = body.split(',');
        dataArray.forEach(d => {
            repoNameArray = d.split('/');
            repos.push({ 'repoName': repoNameArray[repoNameArray.length - 1], 'repoUrl': d });
        });
    }
    return (new Promise(function(resolve,reject){
        resolve(repos);
        })
    ) */
}

function reNamekey(data) {
    let newKeyObj = {};
    _.each(data, function (value, key) {
        key = IDMAP[key] || key;
        newKeyObj[key] = value;
    });
    return newKeyObj;
}

function existsVca(req,next) {
    let sqlQuery = `select * from master_repository_details where id=$1 and tenant_id= $2`;
    return req.gamma.query(sqlQuery, [req.params.accountId, req.session.tenant_id],next)
    .then(vcaAccount => {
        return new Promise((resolve, reject) =>{
            if (!vcaAccount || vcaAccount.length == 0) {
                reject(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            }
            else {
                resolve(vcaAccount);
            }
        });
    });
}