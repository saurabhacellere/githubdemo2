let sqlQuery;
const errors = require('throw.js');
import log from './../../../utils/logger';
import async from 'async';
import * as cf from './../../../utils/common-functions';
import * as gamma from './../../../core/gamma';
import * as emailSender from './../../../component/email';
import * as license from './../../../services/license';
import * as gammaConfig from './../../../core/config';
import * as db from './../../../component/db';

//add new user
export async function create(req, res, next) {
    req.body.email = req.body.email.toLowerCase();
    let email = cf.parseString(req.body.email);
    let emailPattern = /^(?!\.)((?!.*"\.{2})[a-zA-Z0-9\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF\.!#$%&'@\\ "*+-/=?^_`{|}~\-\d]+)@(?!\.)([a-zA-Z0-9\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF\-\.\d]+)((\.([a-zA-Z\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF]){2,63})+)$/i;
    if (!req.body.firstName || req.body.firstName == "") {
        return next(new errors.BadRequest('Please enter first name.', 1000));
    }
    if (!req.body.lastName || req.body.lastName == "") {
        return next(new errors.BadRequest('Please enter last name.', 1000));
    }
    if (!email || email == "") {
        return next(new errors.BadRequest('Please enter email id.', 1000));
    }
    if(!emailPattern.test(email)){
        return next(new errors.BadRequest('Please enter valid email address.', 1000));
    }
    let image=''
    if (req.body.image != undefined) {
        image = req.body.image;
    }

    if (cf.hasPermission(req, 'ADD_USER')) {
        checkUserStatus(req,res,next)
        .then(result => {
            return getUserData(req,res,next)
            .then(user => {
                let salt = cf.makeSalt();
                if (!user || user.length == 0) {
                    return insertUserData(req,res,next,salt)
                    .then(function() {
                        let requestBody = {
                            tenant_uid: req.session.tenant_uid,
                            log: "1 user added with email:" + email,
                            metrics: [{
                                metric: "users",
                                value: 1
                            }]
                        };
                        cf.getDomainURL(req.session.tenant_uid, "tenant_uid").then(function (domainURL) {
                            let reqIP = req.ip;
                            let timestamp = Date.now();
                            let url_obj = {
                                'emailid': email,
                                'reqip': reqIP,
                                'timestamp': timestamp,
                                'newuser': true,
                                'tenant_uid': req.session.tenant_uid
                            };
                            let url_obj_str = (JSON.stringify(url_obj));
                            let encryptedURL = cf.encryptURL(url_obj_str);
                            let url_hash = domainURL + '/reset_password/' + encryptedURL;
                            license.updateUsage(requestBody);
                            emailSender.sendMail('welcome-email', {
                                'subject': 'Welcome aboard Gamma!',
                                'base_url': domainURL,
                                'web_url': cf.getWebSiteURL(),
                                'email_type': "welcome-email",
                                'email': email,
                                'username': email,
                                'first_name': req.body.first_name,
                                'link': url_hash,
                                /*  'password': password, */ 'gamma_url': domainURL,
                                'image_url': domainURL,
                                'is_primary': false,
                                'licence_url': domainURL + '/licence_url'
                            });
                            
                            res.status(201).json({
                                status: 'success',
                                message: 'User added successfully.',
                                details: 'User added successfully.',
                            });
                        });
                    });
                } else {
                    return next(new errors.CustomError("DuplicateUserError", "This email address is already in use", 400, 1101));
                }
            });
        }).catch(err => {
            next(err);
        });
    }
}

function checkUserStatus(req, res, next) {
    return new Promise((resolve, reject) => {
        license.getLicenseDetails(req.session.tenant_uid)
            .then(function (data) {
                let output = data;
                sqlQuery = `select * from users where users.tenant_id=$1 and is_active = 'true'`;
                req.gamma.query(sqlQuery, [req.session.tenant_id], next)
                    .then(result => {
                        let limit = parseInt(output.license_detail.metrics.users.limit);
                        let count = result.length;
                        if (count < limit || limit == -1) {
                            if (!result || result.length == 0) {
                                reject(new errors.BadRequest('User with given tenant id does not exist.', 1000));
                            } else {
                                resolve(result);
                            }
                        } else {
                            reject(new errors.BadRequest('Please suspend/delete existing users or consider upgrading your license', 1764));
                        }
                    });
            });
    });
}

export async function checkActiveUserStatus(userId, req, next) {
    sqlQuery = `select * from users where id=$1 and is_active = 'true'`;
    return req.gamma.query(sqlQuery, [userId],next)
    .then(result=>{
        return new Promise((resolve, reject) =>{
            if (!result || result.length == 0) {
                reject(new errors.BadRequest('User with given user id is not active.',1000));
            }
            else {
                resolve(result);
            }
        });
    });
}
function getUserData(req,res,next) {
    sqlQuery = `select * from users where lower(email)=$1 and tenant_id=$2`;
    return req.gamma.query(sqlQuery, [(cf.parseString(req.body.email)).toLowerCase(), req.session.tenant_id], next)
    .then(result=>{
        return result;
    });
}

function insertUserData(req,res,next,salt) {
    sqlQuery = `do $$
                begin
                insert into users (tenant_id, salt, email, first_name,last_name,image,updated_dt,created_dt) values
                (${req.session.tenant_id},'${salt}','${cf.parseString(req.body.email)}','${cf.parseString(req.body.firstName)}','${cf.parseString(req.body.lastName)}','${req.body.image}',now(),now());
                insert into users_role(user_id, role_id) values((select id from users where lower(email) = '${(cf.parseString(req.body.email)).toLowerCase()}' and tenant_id = ${req.session.tenant_id}), 6);
                end;
                $$;`;
    return req.gamma.query(sqlQuery, [], next)
    .then(result=>{
        return result;
    });
}

//delete user
export async function destroy(req, res, next) {
    //Check user limit here from license
    let userId = req.params.userId;
    //add error handling
    if  (userId != req.session.user_id) {
        getData(req,res,next,userId)
        .then(select_result => {
            if (!select_result || select_result.length == 0) {
                return next(new errors.BadRequest(null, 1000));
            } else if (select_result[0].is_primary || (select_result[0].is_account_admin == 'YES' && !req.session.is_primary) || (!cf.hasRole(req, 'ACCOUNT_ADMINISTRATOR') && cf.hasRole(req, 'USER_ADMINISTRATOR') && select_result[0].is_user_admin == 'YES')) {
                return next(new errors.Forbidden(null, 1007));
            } else {
                sqlQuery = "delete from users where id = $1";
                return req.gamma.query(sqlQuery, [userId], next)
                .then(function() {
                    let isActive = select_result[0].is_active;
                    if (isActive.toString() == 'true') {
                        let requestBody = {
                            tenant_uid: req.session.tenant_uid,
                            log: "1 user deleted with email:" + select_result[0].email,
                            metrics: [{
                                metric: "users",
                                value: -1
                            }]
                        };

                        license.updateUsage(requestBody);
                    }
                    res.status(200).json({
                        status: 'success',
                        message: 'User deleted successfully.',
                        details: 'User deleted successfully.'
                    });
                    let accountStatus = 'deleted';
                    let firstName = select_result[0].first_name;
                    if (accountStatus == 'deleted') {
                        gamma.socket.emit_account_status(userId, 'account_deleted');
                    }
                    cf.getDomainURL(req.session.tenant_uid, "tenant_uid").then(function (domainURL) {
                        emailSender.sendMail('account-status', {
                            'subject': 'Gamma account deleted',
                            'base_url': domainURL,
                            'web_url': cf.getWebSiteURL(),
                            'email_type': "account-delete",
                            'user_name': firstName,
                            'email': select_result[0].email,
                            'account_status': 'deleted',
                            'image_url': domainURL
                        });
                    });
                });
            }
        });
    }else{
        return next(new errors.Forbidden(null, 1007));
    }
}


function getData(req,res,next,userId) {
    sqlQuery = "with x as (select users.id,users.is_active,users.is_primary,users.email,users.first_name,users.last_name from users where tenant_id = $1 and users.id = $2 )select x.id,x.is_active,x.is_primary,x.email, x.first_name, x.last_name , ((select case when count(x.id) = 0 then 'NO' else 'YES' END from users_role join role on users_role.role_id=role.id  where role.identifier='ACCOUNT_ADMINISTRATOR' and users_role.user_id=x.id))as is_account_admin , ((select case when count(x.id) = 0 then 'NO' else 'YES' END from users_role join role on users_role.role_id=role.id  where role.identifier='USER_ADMINISTRATOR' and users_role.user_id=x.id))as is_user_admin from x group by 1,2,3,4,5,6 order by 1 asc";
    return req.gamma.query(sqlQuery, [req.session.tenant_id, userId], next)
    .then(result=>{
        return result;
    });
}

//edit user
export async function update(req, res, next) {
    req.body.email = req.body.email.toLowerCase();
    let emailPattern = /^(?!\.)((?!.*"\.{2})[a-zA-Z0-9\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF\.!#$%&'@\\ "*+-/=?^_`{|}~\-\d]+)@(?!\.)([a-zA-Z0-9\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF\-\.\d]+)((\.([a-zA-Z\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF]){2,63})+)$/i;
    let firstName, lastName, email, userId, queryParams; 
    userId = req.params.userId;
    let image = ''
    if (req.body.image != undefined) {
        image = req.body.image;
    }
    if(req.body.email == '' && req.body.firstName == '' && req.body.lastName == ''){
        return next(new errors.BadRequest('Please enter at least one input.', 1000));
    }
    getData(req,res,next,userId)
    .then(selectResult => {
        //Get Email Address
        if (req.body.email != undefined && req.body.email != '') {
            if(!emailPattern.test(req.body.email)){
                return next(new errors.BadRequest('Please enter valid email address.', 1000));
            }else{
                email = cf.parseString(req.body.email);
            }
        }else if(req.body.email != undefined && req.body.email == ''){
            return next(new errors.BadRequest('Please enter email address.', 1000));
        }else{
            email = cf.parseString(selectResult[0].email);
        }

        //Get First Name
        if (req.body.firstName != undefined && req.body.firstName != '') {
            firstName = cf.parseString(req.body.firstName);
        }else if(req.body.firstName != undefined && req.body.firstName == ''){
            return next(new errors.BadRequest('Please enter first name.', 1000));
        }else{
            firstName = cf.parseString(selectResult[0].first_name);
        }

        //Get Last Name
        if (req.body.lastName != undefined && req.body.lastName != '') {
            lastName = cf.parseString(req.body.lastName);  
        }else if(req.body.lastName != undefined && req.body.lastName == ''){
            return next(new errors.BadRequest('Please enter last name.', 1000));
        }else{
            lastName = cf.parseString(selectResult[0].last_name); 
        }

        if ((selectResult[0].is_account_admin == 'YES' && !req.session.is_primary && req.session.user_id != userId) || (!cf.hasRole(req, 'ACCOUNT_ADMINISTRATOR') && cf.hasRole(req, 'USER_ADMINISTRATOR') && selectResult[0].is_user_admin == 'YES' && req.session.user_id != userId)) {
            return next(new errors.Forbidden(null, 1007));
        } else {
            userExists(req,res,next,userId,email)
            .then(userExists => {
                if (!userExists || userExists.length == 0) {
                    return checkActiveUserStatus(userId, req, next)
                    .then(function(){
                        return selectUser(req,res,next,userId)
                        .then(user => {
                            if (user.length == 0) {
                                return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
                            } else {
                                if(user[0].is_primary && user[0].email!=email){
                                    return next(new errors.Forbidden("Cannot change email address", 1007));
                                }else if (user[0].is_primary && (gammaConfig.skip_license == "false" || gammaConfig.skip_license === false)) {
                                    queryParams = [];
                                    sqlQuery = `DO $$
                                        BEGIN
                                        update users set first_name = '${firstName}',last_name = '${lastName}',email = '${email}',image = '${image}' ,updated_dt = now()
                                        where id = ${userId} and tenant_id = ${req.session.tenant_id};
                                        PERFORM dblink('host=${gammaConfig.websiteDBDetails.dbHostname}
                                        user=${gammaConfig.websiteDBDetails.dbUsername}
                                        password=${gammaConfig.websiteDBDetails.dbPassword}
                                        port=${gammaConfig.websiteDBDetails.dbPort}
                                        dbname=${gammaConfig.websiteDBDetails.dbName}','update tenants set first_name=''${firstName}'', last_name=''${lastName}'' where email=''${user[0].email}'' and tenant_uid=''${req.session.tenant_uid}''' );
                                        End;$$`;
                                } else {
                                    queryParams = [firstName, lastName, email, image, userId, req.session.tenant_id];
                                    sqlQuery = `update users set first_name = $1,last_name = $2,email = $3,image = $4 ,updated_dt = now() where id = $5 and tenant_id = $6`;
                                }
                                return req.gamma.query(sqlQuery, queryParams, next)
                                .then(function () {
                                    if (req.session.user_id == userId) {
                                        sqlQuery = `update "token" set "metadata" = jsonb_set(to_jsonb(metadata),
                                            '{user_image}', to_jsonb('${image}'::text),
                                            true) where "id" = $1`;
                                            return req.gamma.query(sqlQuery, [req.session.tokenId], next)
                                            .then(function() {
                                                log.info('User profile path set successfully!');
                                                res.status(200).json({
                                                    status: 'success',
                                                    message: 'User updated successfully.',
                                                    details: 'User updated successfully.'
                                                });
                                            });
                                    }else{
                                        res.status(200).json({
                                            status: 'success',
                                            message: 'User updated successfully.',
                                            details: 'User updated successfully.'
                                        });
                                    }
                                });
                            }
                        });
                    });
                } else {
                    // user with same email already exists,so return error
                    return next(new errors.CustomError("DuplicateUserError", "Duplicate Email ID", 400, 1101));
                }
            })
            .catch(err => {
                next(err);
            });
        }
    })
    .catch(err => {
        next(err);
    });
}

function userExists(req,res,next,userId,email) {
    sqlQuery = "select * from users where lower(email)=$1 and id != $2 and tenant_id=$3";
    return req.gamma.query(sqlQuery, [email.toLowerCase(), userId, req.session.tenant_id], next)
    .then(result=>{
        return result;
    });
}

function selectUser(req,res,next,userId) {
    sqlQuery = "select * from users where id= $1";
    return req.gamma.query(sqlQuery, [userId], next)
    .then(result=>{
        return result;
    });
}

//get user data
export async function index(req, res, next) {
    let searchString = '',
        orderBy = 'asc',
        orderParam = 'first_name',
        offset = null,
        limit = null;

    if (req.query.searchString){
        searchString = `${req.query.searchString}`;
    }
    if (req.query.orderBy){
        orderBy = `${req.query.orderBy}`;
    }
    if (req.query.orderParam) {
        orderParam = `${req.query.orderParam}`;
    }
    if (req.query.offset){
        offset = `${req.query.offset}`
    };
    if (req.query.limit) {
        limit = `${req.query.limit}`
    };

    switch (orderParam) {
        case 'firstName':
            orderParam = 'first_name';
            break;
        case 'lastName':
            orderParam = 'last_name';
            break;
        default:
            break;
    }

    let userList = {
        'currentUser': req.session.user_id,
        userList: []
    };
    sqlQuery = "select * from get_user_list($1,$2,$3,$4,$5,$6);";
    return req.gamma.query(sqlQuery, [searchString, req.session.tenant_id, orderParam, orderBy, offset, limit], next)
        .then(result => {
            for (let i = 0; i < result.length; i++) {
                let obj = {
                    "userId": result[i].id,
                    "userImage": result[i].image,
                    "userName": result[i].first_name + ' ' + result[i].last_name,
                    "userStatus": result[i].is_active,
                    "userIsPrimary": result[i].is_primary,
                    "allocatedProjectCount": result[i].project_count,
                    "is_account_admin":result[i].is_account_admin,
                    "is_user_admin":result[i].is_user_admin,
                    "role":[]
                };
                if (result[i].is_account_admin){
                     obj.role.push("ACCOUNT_ADMINISTRATOR");
                }
                if (result[i].is_user_admin) {
                    obj.role.push("USER_ADMINISTRATOR");
                }
                userList.userList.push(obj);
            }
            res.status(200).json(userList);
        });
}

//get user data for given user
export async function show(req, res, next) {
    let userId;
    let userDetails = {};
    userId = (!req.params.userId || req.params.userId == '') ? req.session.user_id : req.params.userId;
    
    //add error handling
    if  (userId == req.session.user_id || cf.hasRole(req, 'ACCOUNT_ADMINISTRATOR') || cf.hasRole(req, 'USER_ADMINISTRATOR')) {
        async.parallel({
            userDetails: function (callback) {
                sqlQuery = "select * from users where id = $1 and tenant_id = $2";
                return req.gamma.query(sqlQuery, [userId, req.session.tenant_id], next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            globalRoles: function (callback) {
                sqlQuery = "select * from role where type = 'Global'";
                return req.gamma.query(sqlQuery, [], next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            projectLevelRoles: function (callback) {
                sqlQuery = "select id as value , identifier as label from role where type = 'Project'";
                return req.gamma.query(sqlQuery, [], next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            userGlobalRoles: function (callback) {
                sqlQuery = "select role_id from users_role where user_id = $1";
                return req.gamma.query(sqlQuery, [userId])
                    .then(data => {
                        callback(null, data);
                    });
            },
            userProjectRoles: function (callback) {
                let params = [];
                //sql_projectrole_details = "WITH x as (select system_id,role_id from user_system where user_id= '" + user_id + "' and tenant_id ='" + req.session.tenant_id + "') select system.id as project_id,system.name as project_name ,role.id as project_role from system,role where (system.id,role.id) in (select x.system_id,x.role_id from x) order by project_id";
                if (cf.hasPermission(req, 'VIEW_PROJECT_ROLE') || cf.hasRole(req, 'ACCOUNT_ADMINISTRATOR')) {

                    if (cf.hasRole(req, 'ACCOUNT_ADMINISTRATOR') || cf.hasRole(req, 'PROJECT_ADMINISTRATOR')) {

                        sqlQuery = "WITH x as (select project_id,role_id from user_project where user_id= $1 and tenant_id =$2) select project.id as project_id,project.name as project_name ,role.id as project_role from project,role where (project.id,role.id) in (select x.project_id,x.role_id from x) order by project_id";
                        params = [userId, req.session.tenant_id];
                    } else if (cf.hasRole(req, 'MANAGER')) {

                        sqlQuery = "select project.name as project_name,y.role_id as project_role,y.project_id as project_id " +
                            "from (select user_project.user_id " +
                            ",user_project.role_id,user_project.project_id from user_project join (select " +
                            "user_project.project_id from user_project where user_id=$3 and " +
                            "user_project.tenant_id=$2 and role_id in (select id from role where identifier " +
                            "='MANAGER')) as projects on user_project.project_id=projects.project_id where " +
                            "user_id=$1) as y,users,project where y.user_id=users.id and " +
                            "y.project_id=project.id";
                        params = [userId, req.session.tenant_id, req.session.user_id];
                    }
                    return req.gamma.query(sqlQuery, params, next)
                        .then(data => {
                            callback(null, data);
                        });
                } else {
                    callback(null, []);
                }
            }
        },
        function (err, result) {
            if (err) {
                return next(new errors.InternalServerError(err.message, 1024));
            } else {
                if (!result.userDetails || result.userDetails.length == 0) {
                    res.status(200).json(userDetails);
                } else {
                    userDetails.userId = userId;
                    // userDetails.tenantId = result.userDetails[0].tenant_id;
                    userDetails.firstName = result.userDetails[0].first_name;
                    userDetails.lastName = result.userDetails[0].last_name;
                    userDetails.userEmail = result.userDetails[0].email;
                    // userDetails.password = result.userDetails[0].password;
                    userDetails.userImage = result.userDetails[0].image;
                    userDetails.userStatus = result.userDetails[0].is_active;
                    userDetails.userIsPrimary = result.userDetails[0].is_primary;
                    // userDetails.salt = result.userDetails[0].salt;
                    userDetails.globalRoles = [];
                    for (let i = 0; i < result.globalRoles.length; i++) {
                        let obj = {
                            'roleId': result.globalRoles[i].id,
                            'roleName': result.globalRoles[i].identifier,
                            'status': 0
                        };
                        for (let j = 0; j < result.userGlobalRoles.length; j++) {
                            if (result.globalRoles[i].id == result.userGlobalRoles[j].role_id) {
                                obj.status = 1;
                                break;
                            }
                        }
                        userDetails.globalRoles.push(obj);
                    }
                    userDetails.userGlobalRoles = result.userGlobalRoles;
                    userDetails.userProjectRoles = result.userProjectRoles;
                    userDetails.projectLevelRoles = result.projectLevelRoles;
                    res.status(200).json(userDetails);
                }
            }
        });
    }else{
        return next(new errors.Forbidden(null, 1007));
    }
}

//verify user account
export async function verifyAccount(req,res,next) {
    req.body.email = req.body.email.toLowerCase();
    if (!req.body.email || req.body.email==""){
        return next(new errors.BadRequest('Please enter email Id.',1000));
    }
    if (!req.body.tenantUid || req.body.tenantUid==""){
        return next(new errors.BadRequest('Please enter tenant Uid.',1000));
    }
    checkExistingUser(req,res,next)
    .then(result =>{
        if(result){
            sqlQuery = `update users set is_verify=TRUE where email=$1 and is_primary=$2 and
            tenant_id=(select id from tenant where tenant_uid=$3)`;
            return db.gammaDbPool.query(sqlQuery, [req.body.email,true,req.body.tenantUid],next)
            .then(result=>{
                res.status(200).json({ status: 'success', message: 'Account verified successfully.', details: 'Account verified successfully.' });
            });
        }
    }).catch(error=>{
        return next(error);
    });
}

function checkExistingUser(req,res,next) {
    sqlQuery = `select * from users where lower(email)=$1 and is_primary=$2`;
    return db.gammaDbPool.query(sqlQuery, [req.body.email,true],next)
    .then(result=>{
        return new Promise((resolve, reject) =>{
            if (!result || result.length == 0) {
                reject(new errors.BadRequest('User with given email id does not exist.',1000));
            }
            else {
                resolve(result);
            }
        });
    });
}

//Get permissions data
export async function getPermissionsData(req, res, next) {
    sqlQuery = "select id as role_id ,identifier as role_name ,get_array_of_users_global_role_wise(id,$1) as users from role where type='Global'";
    return req.gamma.query(sqlQuery, [req.session.tenant_id],next)
        .then(result=> {
            if(!result || result.length == 0){
                return(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            }
            else{
                if(!req.session.is_primary)
                {
                    for(let i = 0 ; i < result.length ; i++)
                    {
                        if(result[i].role_name == 'ACCOUNT_ADMINISTRATOR')
                        {
                            (result).splice(i,1);
                        }
                    }
                }
                res.status(200).json(result);
            }
    });
}
