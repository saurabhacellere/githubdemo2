import * as cf from './../utils/common-functions';
const errors = require('throw.js');
import _ from 'underscore';
import * as db from './../component/db';
import gammaConfig from './../core/config';
import request from 'request';
import log from './../utils/logger';

export function runScan(scanDTO, SCAN_REPO_URL) {
    return new Promise((resolve, reject) => {
        request({
                url: SCAN_REPO_URL,
                method: 'POST',
                timeout: 20000,
                headers: {
                    'Content-Type': 'application/json'
                },
                rejectUnauthorized: false,
                //Lets post the following key/values as form
                json: scanDTO
            },
            function (error, response, body) {
                if (error) {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                } else {
                    if (response.statusCode == 200) {
                        resolve();
                    } else {
                        reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                    }
                }
            });
    });
}

export function abortScan(scanId, ABORT_SCAN_URL) {
    log.debug(`${ABORT_SCAN_URL}?sessionId=${scanId}`);
    return new Promise((resolve, reject) => {
        request({
            url: `${ABORT_SCAN_URL}?sessionId=${scanId}`,
            method: 'GET',
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false
        },
        function (error, response, body) {
            log.debug(error);
            log.debug(body);
            log.debug(response.statusCode);
            if (error) {
                log.error(error);
                reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
            } else {
                if (response.statusCode == 200) {
                    resolve();
                } else {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                }
            }
        });
    });
}

export function getRunAnalysisDTO(req) {
    return new Promise(function (resolve, reject) {
        var runAnalysisDTO = {
            "scanSettings": {
                "header": {
                    "sessionId": null,
                    "analysisMode": "FULL",
                    "snapshot": {
                        "mode": "MULTI",
                        "name": "",
                    },
                    "scanProfile": "",
                    "dbCredential": {
                        "connString": "jdbc:postgresql://localhost:5432/corona?currentSchema=schema_1518781298292_h1fkqsepm&user=postgres&password=postgres",
                        "userName": "postgres",
                        "password": "postgres",
                        "proxyUser": "",
                        "schema": ""
                    }
                },
                "dataDir": "D:/temp",
                "repository": {
                    "uid": "",
                    "projectName": "",
                    "sources": {
                        "exclusions": []
                    },
                    "languages": []
                },
                "settings": {
                    "duplication": {
                        "enabled": true,
                        "threshold": 150
                    },
                    "additionalOptions": [],
                    "includePaths": []
                },
                "modules": {

                }
            },
            "scm": {
                "forceUpdate": false,
                "revision": "",
                "repoDTO": {
                    "subsystemUID": "",
                    "userName": "",
                    "password": "",
                    "branchName": "",
                    "projectPath": "",
                    "repositoryURL": "",
                    "repositoryType": "",
                    "authMode": "",
                    "sshKey": "",
                    "passPhrase": "",
                    "localDirectoryPath": ""
                }
            },
            "responseEndPoint": {
                "connString": "",
                "addrType": ""
            },
            "tenant": "",
            "tenant_id": "",
            "gammaUrl": ""
        };
        try {
            sqlQuery = `select coalesce(master_repository_details.name,'') as account_name,coalesce(master_repository_details.additional_details->>'account_type','cloud') as vca_type,y.*,tenant.tenant_uid,tenant.id as tenant_id,tenant.subdomain,
                    jira_details.username as jira_user_name,jira_details.password as jira_password, jira_details.host_name as jira_host_name ,jira_details.build_task_insights as jira_build_task_insights, jira_details.project_key as jira_project_key
                    from
                    (
                        select subsystems.*,master_repository_types.type_name
                        from subsystems left join master_repository_types on  subsystems.subsystem_repository_type=master_repository_types.id where subsystems.subsystem_uid = $1
                    ) as  y  left join master_repository_details on y.master_repository_id=master_repository_details.id
                    left join jira_details on y.subsystem_uid=jira_details.repository_uid,tenant where y.tenant_id = tenant.id`;

            db.gammaDbPool.query(sqlQuery, [req.params.repositoryUid])
            .then(result => {
                try {
                    if (result && result.length > 0) {
                        runAnalysisDTO.scanSettings.header.snapshot.name = req.body.snapshotLabel;
                        sqlQuery = `select * from scan_configuration_modules($1)`;
                        db.gammaDbPool.query(sqlQuery, [req.body.repositoryId])
                        .then(module_result => {
                            try {
                                sqlQuery = `select scr.subsystem_id,m.type,m.name ,array_agg((scr.modified_rule_json))
                                from subsystem_custom_rules SCR
                                inner join
                                language_module_rules LMR
                                on scr.language_module_rules_id =LMR.id
                                inner join language_module LM on
                                lm.id=LMR.Language_module_id
                                inner join module m
                                on m.id=lm.module_id
                                where scr.subsystem_id=$1
                                and lmr.is_active=true
                                and m.is_active=true
                                group by subsystem_id,type,m.name`;
                                var module_category = _.groupBy(module_result, 'module_type');
                                runAnalysisDTO.scanSettings.modules = _.each(module_category, function (item) {
                                    _.each(item, function (outer_item) {
                                        outer_item.name = outer_item.module_name;
                                        outer_item.enabled = outer_item.option_json.enabled;
                                        outer_item.config = {};
                                        outer_item.config.rules = [];
                                        outer_item.config.options = outer_item.option_json.options;
                                    });
                                });

                                db.gammaDbPool.query(sqlQuery, [req.body.repositoryId])
                                .then(rule_result => {
                                    try {
                                        if (rule_result && rule_result.length > 0 && !_.isEmpty(runAnalysisDTO.scanSettings.modules)) {
                                            _.each(rule_result, function (item) {
                                                _.each(runAnalysisDTO.scanSettings.modules[item.type], function (obj, key) {
                                                    if (obj.name == item.name && obj.config != undefined) {
                                                        obj.config.rules = item.array_agg; // Or replace the whole obj
                                                    }
                                                });
                                            });
                                        }
                                        db.getCoronaDBSubdomainPool(result[0].tenant_uid)
                                        .then(dbpool => {
                                            try {
                                                runAnalysisDTO.scanSettings.header.sessionId = cf.generateMD5(req.session.tenant_id + '_' + new Date().getTime());
                                                runAnalysisDTO.scanSettings.header.dbCredential = {
                                                    "connString": cf.encryptStringWithAES(dbpool.connectionString),
                                                    "userName": (result[0].subsystem_repository_user_name == null || result[0].subsystem_repository_user_name == undefined || result[0].subsystem_repository_user_name == '') ? '' : result[0].subsystem_repository_user_name,
                                                    "password": (result[0].subsystem_repository_password == null || result[0].subsystem_repository_password == undefined || result[0].subsystem_repository_password == '') ? '' : result[0].subsystem_repository_password,
                                                    //"proxyUser": dbpool.connectionDetails.CURRENT_USER ,
                                                    "schema": dbpool.connectionDetails.ANALYTICS_SCHEMA
                                                };

                                                var params = {
                                                    'tenant_uid': result[0].tenant_uid,
                                                    'subsystem_uid': result[0].subsystem_uid
                                                };
                                                var temp_path = cf.actualPath(gammaConfig.analysisDBDetails.module_data_src, params);
                                                runAnalysisDTO.scanSettings.dataDir = temp_path;
                                                //runAnalysisDTO.scanSettings.repository.projectName = result[0].subsystem_name;
                                                runAnalysisDTO.tenant = result[0].tenant_uid;
                                                runAnalysisDTO.tenant_id = result[0].tenant_id;
                                                // tenant_name = result[0].tenant_name;
                                                var response_header = 'http';
                                                var response_port = gammaConfig.port;
                                                var response_host = 'localhost';
                                                if (gammaConfig.analysisDBDetails.enableHttps) {
                                                    response_header = 'https';
                                                    response_port = gammaConfig.ssl.port;
                                                }
                                                if ((gammaConfig.analysisDBDetails.analysisHost).indexOf('localhost') == -1)
                                                    response_host = gammaConfig.selfHost;

                                                const SCAN_REPO_CALLBACK_URL = `${response_header}://${response_host}:${response_port}/api/v1/repositories/${req.params.repositoryUid}/scans/${req.body.scanId}/status`;
                                                runAnalysisDTO.responseEndPoint = {
                                                    "addrType": "IPV4",
                                                    "connString": SCAN_REPO_CALLBACK_URL
                                                };
                                                runAnalysisDTO.gammaUrl = `${response_header}://${response_host}:${response_port}`;
                                                //runAnalysisDTO.scanProfile = "";
                                                //runAnalysisDTO.analysisMode = "FULL";
                                                (req.body.fastScan == 'true') ? runAnalysisDTO.scanSettings.header.analysisMode = 'INCREMENTAL' : runAnalysisDTO.scanSettings.header.analysisMode = 'FULL';

                                                var repo_type;
                                                if (result[0].type_name == null || result[0].type_name == undefined || result[0].type_name.toLowerCase() == 'github') {
                                                    repo_type = 'GIT';
                                                }
                                                else if (result[0].type_name.toLowerCase() == 'bitbucket') {
                                                    repo_type = 'BIT';
                                                }
                                                else if (result[0].type_name.toLowerCase() == 'remote') {
                                                    repo_type = 'ZIP';
                                                }
                                                else {
                                                    repo_type = (result[0].type_name).toUpperCase();
                                                }

                                                runAnalysisDTO.scm = {
                                                    "forceUpdate": false,
                                                    "repoDTO": {
                                                        "subsystemUID": result[0].subsystem_uid,
                                                        "userName": (result[0].subsystem_repository_user_name == null || result[0].subsystem_repository_user_name == undefined || result[0].subsystem_repository_user_name == '') ? '' : result[0].subsystem_repository_user_name,
                                                        "password": (result[0].subsystem_repository_password == null || result[0].subsystem_repository_password == undefined || result[0].subsystem_repository_password == '') ? '' : result[0].subsystem_repository_password,
                                                        "branchName": result[0].subsystem_repository_branch_name,
                                                        "projectPath": result[0].subsystem_repository_branch_name,
                                                        "repositoryURL": result[0].subsystem_repository_url,
                                                        "repositoryType": repo_type,
                                                        "vcaType": (result[0].account_name !== ''?result[0].vca_type:''),
                                                        "authMode": result[0].authentication_mode,
                                                        "sshKey": (result[0].ssh_key == null || result[0].ssh_key == undefined || result[0].ssh_key == '') ? '' : result[0].ssh_key,
                                                        "passPhrase": (result[0].passphrase == null || result[0].passphrase == undefined || result[0].passphrase == '') ? '' : result[0].passphrase,
                                                        "localDirectoryPath": cf.actualPath(gammaConfig.analysisDBDetails.data_src, params)
                                                    }
                                                };

                                                log.debug(runAnalysisDTO.scm);

                                                if (req.body.commitId) {
                                                    runAnalysisDTO.scm.revision = req.body.commitId;
                                                    runAnalysisDTO.scm.repoDTO.branchName = "";
                                                }

                                                //runAnalysisDTO.scanSettings.repository.languages.push((result[0].subsystem_language_array[0]).toUpperCase());
                                                runAnalysisDTO.scanSettings.repository = {
                                                    "uid": result[0].subsystem_uid,
                                                    "projectName": result[0].subsystem_name,
                                                    "languages": [(result[0].subsystem_language_array[0]).toUpperCase()],
                                                    "sources": {
                                                        "files": [{
                                                            "path": "/*",
                                                            "action": "A"
                                                        }],
                                                        "exclusions": []
                                                    }
                                                };

                                                if (result[0].analysis_config.extra_options.length) {
                                                    var analysisConfigOptions = result[0].analysis_config.extra_options[0];

                                                    var additionalOptions = (analysisConfigOptions.parser_options).trim();
                                                    if (additionalOptions != '') {
                                                        runAnalysisDTO.scanSettings.settings.additionalOptions = additionalOptions.split(';');
                                                    }

                                                    var exclusions = (analysisConfigOptions.excludes).trim();
                                                    if (exclusions != '') {
                                                        runAnalysisDTO.scanSettings.repository.sources.exclusions = exclusions.split(';');
                                                    }

                                                    if (analysisConfigOptions.includes != undefined) {
                                                        var includePaths = (analysisConfigOptions.includes).trim();
                                                        if (includePaths != '') {
                                                            runAnalysisDTO.scanSettings.settings.includePaths = includePaths.split(',');
                                                        }
                                                    }
                                                }

                                                Object.keys(runAnalysisDTO.scanSettings.modules).forEach(function (module_name_key) {
                                                    if (module_name_key.toLowerCase() == 'relevance') {
                                                        runAnalysisDTO.scanSettings.modules.relevance[0].config.options = [];
                                                        var relevance_options = [];
                                                        if (repo_type == 'GIT' || repo_type == 'BIT' || repo_type == 'SVN') {
                                                            relevance_options.push({
                                                                "name": "mode",
                                                                "value": (repo_type == 'BIT') ? 'git' : (repo_type).toLowerCase()
                                                            });
                                                        }
                                                        // add username & password for svn repositories
                                                        if (repo_type == 'SVN') {
                                                            relevance_options.push({
                                                                "name": "svnUrl",
                                                                "value": result[0].subsystem_repository_url
                                                            }, {
                                                                    "name": "svnUsername",
                                                                    "value": (result[0].subsystem_repository_user_name == null || result[0].subsystem_repository_user_name == undefined || result[0].subsystem_repository_user_name == '') ? '' : result[0].subsystem_repository_user_name
                                                                }, {
                                                                    "name": "svnPassword",
                                                                    "value": (result[0].subsystem_repository_password == null || result[0].subsystem_repository_password == undefined || result[0].subsystem_repository_password == '') ? '' : result[0].subsystem_repository_password
                                                                });
                                                        }
                                                        if (result[0].jira_host_name) { // chk if jira is configured then only add these values
                                                            relevance_options.push({
                                                                "name": "jiraUrl",
                                                                "value": result[0].jira_host_name
                                                            }, {
                                                                    "name": "jiraProjectKey",
                                                                    "value": result[0].jira_project_key
                                                                }, {
                                                                    "name": "jiraUsername",
                                                                    "value": ((result[0].jira_user_name === '3782a4e4855a5a8e423e472dc5e31172') ? '' : result[0].jira_user_name)
                                                                }, {
                                                                    "name": "jiraPassword",
                                                                    "value": ((result[0].jira_password === '3782a4e4855a5a8e423e472dc5e31172') ? '' : result[0].jira_password)
                                                                });
                                                        }
                                                        runAnalysisDTO.scanSettings.modules.relevance[0].config.options = relevance_options;
                                                    }
                                                });

                                                var analysisDTO = {};
                                                analysisDTO.result = result;
                                                analysisDTO.responseDTO = runAnalysisDTO;
                                                req.build_task_insights = result[0].jira_build_task_insights

                                                resolve(analysisDTO);
                                            } catch (error) {
                                                let errorLog = new errors.InternalServerError(error.message, 1018);
                                                reject(errorLog);
                                            }
                                        });
                                    } catch (error) {
                                        let errorLog = new errors.InternalServerError(error.message, 1018);
                                        reject(errorLog);
                                    }
                                });
                            } catch (error) {
                                let errorLog = new errors.InternalServerError(error.message, 1018);
                                reject(errorLog);
                            }
                        });
                    }
                } catch (error) {
                    let errorLog = new errors.InternalServerError(error.message, 1018);
                    reject(errorLog);
                }
            });
        } catch (error) {
            let errorLog = new errors.InternalServerError(error.message, 1018);
            return reject(errorLog);
        }
    });
}

export function getScanProgress(scanId, GET_PROGRESS_SCAN_URL) {
    return new Promise((resolve, reject) => {
        request({
            url: `${GET_PROGRESS_SCAN_URL}?sessionId=${scanId}`,
            method: 'GET',
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false
        },
        function (error, response, body) {
            if (error) {
                reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
            } else {
                if (response.statusCode == 200) {
                    resolve(body);
                } else {
                    reject(new errors.ServiceUnavailable("Gamma service unavailable", 1021));
                }
            }
        });
    });
}