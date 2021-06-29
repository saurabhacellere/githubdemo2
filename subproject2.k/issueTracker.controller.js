let sqlQuery;
const errors = require('throw.js');
import * as cf from '../.././../../../utils/common-functions';
const _ = require('underscore');
import async from 'async';
import log from '../.././../../../utils/logger';
import config from '../.././../../../core/config';
let request = require('request');
import * as db from './../../../../../component/db';
import * as gamma from './../../../../../core/gamma';
const jqlVersion = 'latest';
const IDMAP = {
};

function reNamekey(data) {
    let newKeyObj = {};
    _.each(data, function (value, key) {
        key = IDMAP[key] || key;
        newKeyObj[key] = value;
    });
    return newKeyObj;
}

export function createAuthString(req, res) {
    return new Promise(function (resolve) {
		if (req.body.type == 'open') {
            resolve("");
		} else {
            let credentials = `${req.body.username}:${req.body.password}`;
            credentials = cf.encryptURL(credentials);
            resolve(credentials);
		}
    });
}


export async function getIssueTrackerDetails(req)
{
    let sqlQuery = `select username, password, host_name, project_key, jira_type, is_validate from jira_details where repository_uid = $1 and tenant_id =$2`;
    return req.gamma.query(sqlQuery, [req.params.repositoryUid, req.session.tenant_id])
        .then(data => {
            return data;
        })
        .catch(error => {
            return error;
        });
}

export async function getJiraAccountDetails(req, res, next) {
    let sqlQuery = `select id, username, host_name, project_key, is_validate, repository_id, repository_uid, project_name, user_id, jira_type, build_task_insights, last_build_status, last_build_on, failure_reason from jira_details where repository_uid = $1 and tenant_id = $2`;
    return req.gamma.query(sqlQuery, [req.query.repository_uid, req.session.tenant_id], next)
        .then(data => {
            if (data.length > 0) {
                data[0].username = (data[0].username == '') ? '' : (cf.decryptStringWithAES(data[0].username));
                // data[0].password = (data[0].password == '') ? '' : cf.encryptURL(cf.decryptStringWithAES(data[0].password));
                // if db status is is 'in progress', chk if its actually running by calling status api for task insights
                if (data[0].last_build_status == 'IN_PROGRESS') {
                    request({
                        url: `${config.analysisDBDetails.lpsHost}rest/issuesync/status?repoUid=${data[0].repository_uid}`,
                        method: 'GET',
                        rejectUnauthorized: false,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (error, response, body) {
                        if (error) {
                            log.info("GAMMA JIRA BUILD INSIGHTS SERVICE IS DOWN :== DISCARDING");
                            let errorData = {
                                'status': 'ERROR',
                                'errorMsg': 'Gamma server is not reachable.Please check network connection.'
                            };
                            updateTaskBuildStatus(req, data, errorData)
                                .then(updatedData => {
                                    res.status(200).json(updatedData);
                                })
                                .catch(originalData => {
                                    res.status(200).json(originalData);
                                });
                        } else if (response.statusCode == 500 || response.statusCode == 404) {
                            log.info("SOMETHING WENT WRONG AT INSIGHTS SERVICE :== DISCARDING");
                            let errorData = {
                                'status': 'ERROR',
                                'errorMsg': 'Gamma server is not reachable.Please check network connection.'
                            };
                            updateTaskBuildStatus(req, data, errorData)
                                .then(updatedData => {
                                    res.status(200).json(updatedData);
                                })
                                .catch(originalData => {
                                    res.status(200).json(originalData);
                                });
                        } else if (response.statusCode == 200) {
                            body = JSON.parse(body);
                            if (body.status == 'INPROGRESS') { // no need to update in db , as build is still in progress
                                res.status(200).json(data);
                            } else if (body.status == 'ERROR' || body.status == 'SUCCESS') {
                                // this is to check , if somwhow tomcat was not able to sned success/error response to gamma-ui,so in db its still in progress. With this condition in place it will update db with last lps build status
                                updateTaskBuildStatus(req, data, body)
                                    .then(updatedData => {
										res.status(200).json(updatedData);
                                    })
                                    .catch(originalData => {
										res.status(200).json(originalData);
                                    });
                            } else { // if last status is other than above ,(eg 'NOT_REQUESTED')
                                res.status(200).json(data);
                            }
                        }
                    });
                } else {
                    res.status(200).json(data);
                }
            } else {
                res.status(200).json(data);
            }
		})
		.catch(error => {
            return next(error);
        });
}

function updateTaskBuildStatus(req, data, statusMsg) {
    return new Promise((resolve, reject) => {
        let sqlQuery = `update jira_details set last_build_status=$2, failure_reason=$3 where repository_uid=$1`;
        return req.gamma.query(sqlQuery, [data[0].repository_uid, statusMsg.status, statusMsg.errorMsg])
            .then(updateData => {
                data[0].last_build_status = statusMsg.status;
                data[0].failure_reason = statusMsg.errorMsg;
                resolve(data);
            })
            .catch(err => {
                reject(data);
            });
    });
}

function getJiraAccountPassword(req){
    let sqlQuery = 'select password from jira_details where username=$1 and repository_uid = $2';
    return req.gamma.query(sqlQuery,[cf.encryptStringWithAES(req.query.username), req.query.repository_uid])
        .then(accountPassword  =>{
        return (cf.decryptStringWithAES(accountPassword[0].password));
    })
}
export async function getJiraTaskList(req, res, next) {
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.password = accountPassword;
        req.body.type = req.query.type;
        req.body.username = req.query.username;
        // req.body.password = req.query.password;
        let jqlString = req.query.query;
    // check if current context is components, then get Jira issue ids from db
        if (req.query.currentContext == 'components') {
            let sqlQuery = `select linked_issues from relevance where nodeid=$1 and snapshot_id=$2`;
            return req.corona.query(sqlQuery, [req.query.nodeId, req.query.snapshotId])
            .then(linkedIssuesData=>{
                var linkedIssuesStr = "";
                if (linkedIssuesData.length) {
                    try {
                        let linkedIssues = JSON.parse(linkedIssuesData[0].linked_issues);
                        //add filter for key in jql if there are issues linked to given component
                        if (linkedIssues != null && (linkedIssues.issues).length ) {
                            linkedIssuesStr = cf.convertToString(linkedIssues.issues);
                            jqlString = `${jqlString} AND key in (${linkedIssuesStr})`;
                            getJiraIssuesByJql(req, res, next, jqlString);
                        }else{
                            res.status(200).json({
                                    "message":{'startAt':	0,
                                        'maxResults'	:20,
                                        'total':	0,
                                        'issues':[]
                                    },
                                    'status': "success"
                            });
                        }
                    } catch (err) {
                        log.error(err);
                        res.status(200).json({
                            "message":{'startAt':	0,
                                'maxResults'	:20,
                                'total':	0,
                                'issues':[]
                            },
                            'status': "success"
                        });
                        //return next(new errors.CustomError("relevanceDataIssue", "Error while fetching relevance data", 400, 1930));
                    }
                }
                else {
                    res.status(200).json({
                        "message":{'startAt':	0,
                            'maxResults'	:20,
                            'total':	0,
                            'issues':[]
                        },
                        'status': "success"
                    });
                }
            })
        }
        else {
            getJiraIssuesByJql(req, res, next, jqlString);
        }
    });
}

function getJiraIssuesByJql(req, res, next, jqlString) {
    createAuthString(req, res, next)
    .then(function (session) {
        // create request string
        let requestString = {
            url: `${req.query.host_url}rest/api/2/search`,//rest/api/2/search?${jqlString}&startAt=${req.query.start_index}&maxResults=20`,
            method: 'POST',
            json:{
                "jql": jqlString,
                "startAt": req.query.start_index,
                "maxResults": 20
            },
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false
        };

        // if account is non open source then only send session
        if (req.query.type === 'restricted') {
            requestString.headers.Authorization = `Basic ${session}`;
        }
        // request
        request(requestString, function (error, response, body) {
            let err;
            if (error) {
                // throw error when get time out
                log.debug(error);
                return next(new errors.CustomError("jiraServerError", "Problem occurred while connecting to JIRA server", 400, 1907));

            } else {
                // call error handler
                jiraResponseHandler(req, res, next, response);
            }
        });
    })
    .catch(err => {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}

export async function getAssignee(req, res, next) {
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.password = accountPassword;
        req.body.type = req.query.type;
        req.body.username = req.query.username;
    createAuthString(req, res, next)
        .then(function (session) {
            // create request string
            let requestString = {
                method: 'GET',
                timeout: 100000,
                headers: {
                    'Content-Type': 'application/json'
                },
                rejectUnauthorized: false,
                json: {}
            };
            if (req.query.type == 'open') {
                requestString.url = `${req.query.host_url}rest/api/2/user/assignable/multiProjectSearch?projectKeys=${req.query.project_key.toUpperCase()}&username=${req.query.term}&maxResults=1000`;
                //requestString.url = req.query.host_url + 'rest/api/2/user/assignable/search?project=' + req.query.project_key.toUpperCase();
            } else {
                // if account is not open source then only set session
                requestString.headers['Authorization'] = `Basic ${session}`;
                requestString.url = `${req.query.host_url}rest/api/2/user/assignable/multiProjectSearch?projectKeys=${req.query.project_key.toUpperCase()}&username=${req.query.term}&maxResults=1000`;
            }
            // request
            request(requestString, function (error, response, body) {
                let err;
                if (error) {
                    log.error(error);
                    // throw error when get time out
                    return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
                } else {
                    // call error handler
                    jiraResponseHandler(req, res, next, response);
                }
            });
        })
        .catch(err => {
            return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
        });
    });
}
export async function createJiraMeta(req, res, next) {
    return getJiraAccountPassword(req)
    .then(accountPassword => {
    req.body.username = req.query.username;
    req.body.password = accountPassword;
    createAuthString(req, res, next)
        .then(function (session) {
            let requestString = {
                url: req.query.host_url + `rest/api/${jqlVersion}/issue/createmeta?expand=projects.issuetypes&projectKeys=` + req.query.project_key,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                },
                rejectUnauthorized: false,
                json: {}
            };
            // if account is not open source then only set session
            if (req.query.type === 'restricted') {
                requestString.headers.Authorization = `Basic ${session}`;
            }
            // request
            request(requestString, function (error, response, body) {
                if (error) {
                    // throw error when get time out
                    log.debug(error);
                    return next(new errors.CustomError("jiraServerError", "Problem occurred while connecting to JIRA server", 400, 1907));
                } else {
                    // call error handler
                    jiraResponseHandler(req, res, next, response);
                }
            });

		});
    })
    .catch(err => {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}

export async  function getStatuses(req, res, next) {
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.type = req.query.type;
        req.body.username = req.query.username;
        req.body.password = accountPassword;
        createAuthString(req, res, next)
            .then(function (session) {
                let requestString = {
                    url: req.query.host_url + `rest/api/${jqlVersion}/status`,
                    method: 'GET',
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    rejectUnauthorized: false,
                    json: {}
                };
                // if account is not open source then only set session
                if (req.query.type === 'restricted') {
                    requestString.headers.Authorization = `Basic ${session}`;
                }
                // request
                request(requestString, function (error, response, body) {
                    if (error) {
                        // throw error when get time out
                        log.debug(error);
                        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));

                    } else {
                        // call error handler
                        jiraResponseHandler(req, res, next, response);
                    }
                });

            });
    }).catch(err => {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}


export async function getPriorities(req, res, next) {
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.type = req.query.type;
        req.body.username = req.query.username;
        req.body.password = accountPassword;
        createAuthString(req, res, next)
            .then(function (session) {
                // create request string
                let requestString = {
                    url: req.query.host_url + `rest/api/${jqlVersion}/priority`,
                    method: 'GET',
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    rejectUnauthorized: false,
                    json: {}
                };
                // if account is not open source then only set session
                if (req.query.type === 'restricted') {
                    requestString.headers.Authorization = `Basic ${session}`;
                }
                // request
                request(requestString, function (error, response, body) {
                    if (error) {
                        // throw error when get time out
                        log.debug(error);
                        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));

                    } else {
                        // call error handler
                        jiraResponseHandler(req, res, next, response);
                    }
                });
            });
    }).catch(err => {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}


export async function getIssueTypes(req, res, next) {
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.type = req.query.type;
        req.body.username = req.query.username;
        req.body.password = accountPassword;
        createAuthString(req, res, next)
            .then(function (session) {
                // create request string
                let requestString = {
                    url: req.query.host_url + `rest/api/${jqlVersion}/issuetype`,
                    method: 'GET',
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    rejectUnauthorized: false,
                    json: {}
                };

                // if account is not open source then only set session
                if (req.query.type === 'restricted') {
                    requestString.headers.Authorization = `Basic ${session}`;
                }
                // request
                request(requestString, function (error, response, body) {
                    if (error) {
                        // throw error when get time out
                        log.debug(error);
                        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));

                    } else {
                        // call error handler
                        jiraResponseHandler(req, res, next, response);
                    }
                });

            });
    }).catch(err => {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}


export async function getJiraIssueDetails(req,res,next){
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.type = req.query.type;
        req.body.username = req.query.username;
        req.body.password = accountPassword;
        createAuthString(req, res, next)
        .then( function(session) {
            // create request string
            let requestString = {
                url: req.query.host_url + `rest/api/${jqlVersion}/issue/` + req.query.jira_id,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                },
                rejectUnauthorized: false,
                json: {}
            };

            // if account is non open source then only send session
            if (req.query.type === 'restricted') {
                requestString.headers.Authorization = `Basic ${session}`;
            }
            // request
            request(requestString, function (error, response, body) {
                let err;
                if (error) {
                    // throw error when get time out
                    log.debug(error);
                    return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
                }
                else if (response.statusCode === 200 || response.statusCode === 201) {
                        if(req.query.isTasksInsightEnabled === 'true' && req.query.build_task_insights === 'true') {
                            let sql_query = `select last_build_status, last_build_on, failure_reason from jira_details where repository_uid = $1 and tenant_id =$2`;
                            return req.gamma.query(sql_query, [req.query.repository_uid, req.session.tenant_id],next)
                            .then(data => {
                                if (data.length > 0) {
                                    body.task_insights = {
                                        status:'',
                                        last_build_status:data[0].last_build_status,
                                        last_build_on: data[0].last_build_on,
                                        failure_reason: data[0].failure_reason,
                                        users: [],
                                        files: []
                                    };
                                    if (body.fields.status.name != 'Resolved' && body.fields.status.name != 'Closed') {
                                        let issueText = body.fields.summary + "\n" + (body.fields.description) ? body.fields.description : '';
                                        request({
                                            url: `${config.analysisDBDetails.lpsHost}rest/issuesync/issueInsights?repoUid=${req.query.repository_uid}&issueText=${issueText}`, //&componentName=${jira_component_name}`,
                                            method: 'GET',
                                            rejectUnauthorized: false,
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            json: {}
                                        }, function(error, response, body1) {
                                            log.error(error);
                                            log.debug(body1);
                                            if (error) {
                                                body.task_insights.status = 'ERROR';
                                                body.task_insights.code = 'Insights_Server_Error';
                                                res.json(200, {
                                                    status: 'success',
                                                    message: body
                                                });
                                            } else {
                                                if (response.statusCode == 500) {
                                                    log.info("SOMETHING WENT WRONG AT GAMMA JIRA SERVICE");
                                                    body.task_insights.status = 'ERROR';
                                                    body.task_insights.code = 'Insights_Server_Error';
                                                    res.json(200, {
                                                        status: 'success',
                                                        message: body
                                                    });
                                                } else if (response.statusCode == 404) {
                                                    log.info("GAMMA JIRA BUILD INSIGHTS SERVICE IS DOWN :== DISCARDING");
                                                    body.task_insights.status = 'ERROR';
                                                    body.task_insights.code = 'Insights_Server_Error';
                                                    res.json(200, {
                                                        status: 'success',
                                                        message: body
                                                    });
                                                } else {
                                                    if (body1.status == 'ERROR') {
                                                        body.task_insights.status = 'ERROR';
                                                        body.task_insights.code = 'Insights_Not_Found';
                                                        res.json(200, {
                                                            status: 'success',
                                                            message: body
                                                        });
                                                    } else {
                                                        body.task_insights.status = 'SUCCESS';
                                                        body.task_insights.users = (body1.users) ? (body1.users) : [];
                                                        body.task_insights.files = (body1.files) ? (body1.files) : [];

                                                        function getFileComponent(file, callback) {
                                                            let sql_query = `select * from (select n2.id, n2.displayname, s.id as subsystem_id, s.subsystem_uid, s.subsystem_name , m.value from nodes n, node_file nf, nodes n2 ,subsystems s, measurements m
                                                                            where n.signature=$1
                                                                            and n.id = nf.file_id
                                                                            and n2.id = nf.component_id
                                                                            and n2.nodetype in (select id from node_types where classification= 'COMPONENTS')
                                                                            and s.id = n.subsystem_id
                                                                            and s.id = n2.subsystem_id
                                                                            and s.subsystem_uid = $2
                                                                            and m.nodeid=nf.file_id
                                                                            and m.measureid= (select id from measures where measurename='LOC')) t
                                                                            cross join (select count(obj) from file_issue_mappings, jsonb_array_elements(issue_details) obj
                                                                            where obj->>'issueType' = 'Bug' and
                                                                            file_path = $1) v
                                                                            `;
                                                            return req.corona.query(sql_query, [file.path, req.query.repository_uid],next)
                                                            .then(data => {
                                                                if (data.length) {
                                                                    file.component_id = data[0].id;
                                                                    file.component_name = data[0].displayname;
                                                                    file.subsystem_id = data[0].subsystem_id;
                                                                    file.subsystem_uid = data[0].subsystem_uid;
                                                                    file.subsystem_name = data[0].subsystem_name;
                                                                    file.loc = data[0].value;
                                                                    file.jira_issues = data[0].count;
                                                                    sql_query = `select p.id, p.name from project p,project_subsystem ps,subsystems s
                                                                            where s.subsystem_uid = $1
                                                                            and s.subsystem_id = ps.subsystem_id
                                                                            and ps.project_id = p.id`;

                                                                    return req.gamma.query(sql_query, [req.query.repository_uid],next)
                                                                        .then(data1 => {
                                                                            file.project_id = data1[0].id;
                                                                            file.project_name = data1[0].name;
                                                                            callback.call();
                                                                        });
                                                                } else
                                                                    callback.call();
                                                            });
                                                        }

                                                        async.forEach(body.task_insights.files, getFileComponent, function(err, results) {
                                                            if (err) {
                                                                return next(new errors.CustomError("insightsServerError", "Insights Srver Error", 400, 1909));

                                                            } else {
                                                                res.json(200, {
                                                                    status: 'success',
                                                                    message: body
                                                                });
                                                            }
                                                        });
                                                    }
                                                }
                                            }
                                        });
                                    } else {
                                        res.json(200, {
                                            status: 'success',
                                            message: body
                                        });
                                    }
                                }
                            });
                        }else {
                            res.json(200, { status: 'success', message: body });
                        }
                    } else if (response.statusCode == 400) {

                        return next(new errors.CustomError("jiraInvalidRequest", "Jira Invalid Request", 400, 1908));

                    } else {
                        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));

                    }
            });
        });
    }).catch(err=>{
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}



function jiraResponseHandler(req, res, next, response) {
    let statusCode = response.statusCode;
    let object, errorMessage;
    let err;
    if (statusCode == 200 || statusCode == 201) { // Success
        res.status(200).json(statusCode, {
            status: 'success',
            message: response.body
        });
    } else if (statusCode == 400) {
        object = (_.isEmpty(response.body.errors) ? response.body.errorMessages : response.body.errors);
        _.map(object, function (val, key) {
            errorMessage = object[key];
        });
        return next(new errors.CustomError(errorMessage, errorMessage, 400, ''));
    } else if (statusCode == 401) {
        return next(new errors.CustomError("jiraUserUnauthorized", "Jira User Unauthorized", 400, 1901));
    } else if (statusCode === 403) {
        return next(new errors.CustomError("jiraLoginDenied", "Jira Login Denied", 400, 1902));
    } else if (statusCode == 404) {
        return next(new errors.CustomError("jiraUserNotFound", "Jira User Not Found", 400, 1903));
    } else if (statusCode == 405) {
        return next(new errors.CustomError("jiraInvalidProjectKey", "Jira Invalid Project Key", 400, 1904));
    } else if (statusCode == 500) {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1905));
    } else if (statusCode == 503) {
        return next(new errors.CustomError("jiraSiteUnavailable", "Jira Site Unavailable", 400, 1906));
    } else {
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    }
}


export async function validateProject(req, res, next) {
    createAuthString(req, res, next)
        .then(function (session) {
            let project_key = req.body.project_key.toUpperCase();
            // create request string
            let requestString = {
                url: req.body.host_url + `rest/api/${jqlVersion}/projectvalidate/key?key=` + project_key,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                },
                rejectUnauthorized: false,
                json: {}
            };

            // if account is not open source then only set session
            if (req.body.type === 'restricted') {
                requestString.headers.Authorization = `Basic ${session}`;
            }

            // request
            request(requestString, function (error, response, body) {
                let err;
                if (error) {
                    log.debug(error);
                    return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));

                } else if (response.statusCode == 200 || response.statusCode == 201) { // success
                    if (_.isObject(body)) { // check for json object ::: in some cases it returns response in HTML format
                        if (body.errors.projectKey !== undefined) {
                            if (body.errors.projectKey.includes('uses this project key')) {
                                // add jira acount details into the database
                                projectKey(req, res, next, body, response);
                            } else {
                                // Jira project key is invalid :: status code : 200
                                return next(new errors.CustomError("jirainvalidprojectkey", "Jira Invalid Project Key", 405, 1904));

                            }
                        } else {
                            // Jira project key is invalid :: status code : 200
                            return next(new errors.CustomError("jirainvalidprojectkey", "Jira Invalid Project Key", 405, 1904));

                        }
                    } else {
                        // Jira URL is invalid :: status code : 200
                        return next(new errors.CustomError("jiraInvalidUrl", "Jira Invalid Url", 400, 1910));

                    }
                } else {
                    jiraResponseHandler(req, res, next, response);
                }
            });
        }).catch(err => {
            return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
        });
}



function projectKey(req, res, next, body, response) {
    let username, password, host, project_key, project_name, repository_id, repository_uid, repository_name, user_id, tenant_id, jira_type, buildTaskInsights;
    let sqlQuery;
    if (req.body.type == 'restricted') {
        username = (req.body.username === '') ? '' : cf.encryptStringWithAES(req.body.username);
        password = (req.body.password === '') ? '' : cf.encryptStringWithAES(req.body.password);

    } else if (req.body.type == 'open' && req.body.username == 'anonymous') {
        username = cf.encryptStringWithAES('anonymous');
        password = cf.encryptStringWithAES('anonymous');
    }
    host = req.body.host_url;
    project_key = req.body.project_key.toUpperCase();
    project_name = body.errors.projectKey.split('\'')[1];
    repository_id = req.body.repository_id;
    repository_uid = req.body.repository_uid;
    repository_name = req.body.repository_name;
    user_id = req.session.user_id;
    tenant_id = req.session.tenant_id;
    jira_type = req.body.type;
    buildTaskInsights = req.body.taskInsightsCheckoxStatus;

    sqlQuery = `select count(*) from jira_details where repository_uid = $1`;
    return req.gamma.query(sqlQuery, [repository_uid],next)
        .then(data => {

            if (data[0].count == 1) {
                sqlQuery = `update jira_details set username=$1,password=$2,host_name=$3,project_name=$4,project_key=$5,repository_name=$6,is_validate=true,repository_id=$7,jira_type=$9,build_task_insights=$10 where repository_uid=$8`;
                return req.gamma.query(sqlQuery, [username, password, host, project_name, project_key, repository_name, repository_id, repository_uid, jira_type, buildTaskInsights],next)
                    .then(data => {
                        res.status(200).json( {
                            status: 'success',
                            message: 'Jira account updated successfully.',
                            details: 'Jira account updated successfully.'
                        });
                    });

            } else {
                sqlQuery = `insert into jira_details(username,password,host_name,project_key,project_name,is_validate,repository_uid,repository_id,repository_name,user_id,tenant_id, jira_type, build_task_insights)values($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12)`;
                return req.gamma.query(sqlQuery, [username, password, host, project_key, project_name, repository_uid, repository_id, repository_name, user_id, tenant_id, jira_type, buildTaskInsights],next)
                    .then(data => {

                        res.status(200).json(response.statusCode, {
                            status: 'success',
                            project_name: body.errors.projectKey.split('\'')[1],
                            message: body.errors.projectKey,
                            details: body.errors.projectKey
                        });
                    });
            }
        });
}

export async function jiraDeleteAccount(req, res, next) {
    deleteJiraTaskInsights(req.params.repositoryUid)
    .then(function () {
        deleteJiraIntegration(req, res, next)
    }).catch(err => {
        log.error(err);
        deleteJiraIntegration(req, res, next)
    });
}

export function deleteJiraTaskInsights(repositoryUid) {
    log.info("DELETING OLD INSIGHTS DATA");
    return new Promise(function (resolve, reject) {
        request({
            url: `${config.analysisDBDetails.lpsHost}rest/issuesync/issueInsights/${repositoryUid}`,
            method: 'DELETE',
            timeout: 30000,
        }, function (error, response, body) {
            if (error) {
                // throw error when get time out
                log.error(error);
                reject(new errors.CustomError("jiraServerError", "Jira Server Error", 400, 1907));
            } else {
                if (response.statusCode == 200) {
                    resolve('ok');
                } else {
                    reject(new errors.CustomError("jiraServerError", "Jira Server Error", 400, 1907));
                }
            }
        });
    });
}

function deleteJiraIntegration(req, res,next){
    let sql_query = `delete from jira_details where repository_uid = $1 and tenant_id =$2`;
    return req.gamma.query(sql_query, [req.params.repositoryUid, req.session.tenant_id],next)
    .then(data => {
        res.json(data);
    });
}

export async function createJiraIssue(req,res,next){
    req.query.repository_uid = req.body.repository_uid;
    req.query.username = req.body.username;
    return getJiraAccountPassword(req)
    .then(accountPassword => {
        req.body.password = accountPassword;
    createSession(req, res, next)
    .then( function(session) {
        // create request json
    let fileDTO = {
            "fields": {
                "project":
                {
                    "key": '' + req.body.project_key.toUpperCase()
                },
                "summary": '' + req.body.issue_title,
                "description": '' + req.body.task_desc,
                "issuetype": {
                    //"name": '' + req.body.issue_type
                    "id": req.body.issue_type_id
                },
                "priority": {
                    //"name": '' + req.body.priority
                    "id": req.body.priority_id
                },
               "labels":["Gamma"]
            }
        };
        // check for assignee
        if (req.body.assignee != 'unassigned'){
            fileDTO.fields.assignee = {
                "name": req.body.assignee
                //"key": req.body.assignee_key
            };
        } else if (req.query.due_date != 'no_due_date') {
            // check for due date
            fileDTO.fields.duedate = req.body.due_date;
        }
        // create request string
        let requestString = {
            url: req.body.host_url + `rest/api/${jqlVersion}/issue`,
            method: 'POST',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false,
            json: fileDTO
        };
        // if account is not open source then only set session
        if (req.body.type === 'restricted') {
            requestString.headers.Authorization = `Basic ${session}`;
        }

        // request
        request(requestString, function (error, response, body) {
            if (error) {
                // throw error when get time out;
                return next(new errors.CustomError("jiraServerError", "Jira Server Error", 400, 1907));
            }else {
                jiraResponseHandler(req, res, next, response);
            }
        });

    })
    }).catch(err=>{
        return next(new errors.CustomError("jiraServerError", "Jira User Unauthorized", 400, 1907));
    });
}


function createSession(req) {
    return new Promise(function (resolve, reject) {
     try {
            let session = Buffer.from(req.body.username+":"+req.body.password).toString('base64');
            resolve(session);
        } catch (err) {
            reject(err);
        }
    });
}
