import log from './../utils/logger';
import gammaConfig from './../core/config';
const errors = require('throw.js');

import _ from 'underscore';

export function catchError(fn) {
    return function (req, res, next) {
        // Make sure to `.catch()` any errors and pass them along to the `next()`
        // middleware in the chain, in this case the error handler.
        fn(req, res, next).catch(next);
    };
}

export function handleError(err, req, res, next) {
    // in case of customErrors
    if (err.hasOwnProperty('errorCode')) {
        if (err.statusCode != 500) {
            err = _.omit(err, err.stack);
        }
        sendError(req, err, res);
    }
    else { // in case of errors thrown by node
        sendError(req, new errors.InternalServerError(err.message, 1017), res);
    }
};

function sendError(req, err, res) {
    var protocol = req.protocol;
    if (gammaConfig.gamma_ui_env == 'live') {
        protocol = 'https';
    }
    err.url = protocol + "://" + req.get('host') + req.url;
    if(req.session) {
        err.tenant = req.session.tenant_uid;
    }
    if (err.statusCode != 204) {
        log.error(err);
    }
    else {
        log.info(err);
    }
    res.status(err.statusCode).send({"error":{
        "code": err.errorCode,
        "name": err.name,
        "message": err.message
    }});
    res.end();
}