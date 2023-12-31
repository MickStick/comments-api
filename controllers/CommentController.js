const CommentService = require("../services/CommentService");
const RestResponse = require('../utility/RestResponse');
const Log = require("../utility/Log");
const escapeHtml = require('escape-html');
const NodeCache = require('node-cache');
const cache = new NodeCache();

class CommentController {

    constructor() {
        this.commentServcie = new CommentService();
    }

    /**
     * This method is responsible for validating the request body sent over when adding or updating
     * a comment record.
     * @param {Object} obj - Comment object received as input
     * @returns {Object} obj
     */
    sanitizeCommentObject(obj) {

        Log.inform("Sanitizing Comment Object");
        for (let k of Object.keys(obj)) {
            if (/[a-zA-Z]/.test(obj[k])) {
                obj[k] = escapeHtml(obj[k])
            }
        }
        Log.inform("Sanitized Comment Object!");

        return obj;
    }

    /**
     * This method is responsible for validating the request body sent over when adding or updaing
     * an comment record.
     * @param {Object} body - JSON Object containing endorsement data
     * @returns {Object} errList - Array of string messages detailing validation errors
     */
    validateCommentBody(body) {

        let errList = [];
        let strReg = /[a-zA-Z]/;
        let numReg = /[0-9]/;

        if(body.cid){
            //validate Comment ID
            Log.inform("Valiating Comment ID!");
            if (body.uid == "undefined"
                || body.uid == null
                || !numReg.test(body.uid)) {
                errList.push("Invalid User ID! User ID must be a number!");
            }
        }
        

        //validate User ID
        Log.inform("Valiating Comment User ID!");
        if (body.uid == "undefined"
            || body.uid == null
            || !numReg.test(body.uid)) {
            errList.push("Invalid User ID! User ID must be a number!");
        }

        //validate Post ID
        Log.inform("Valiating Comment Post ID!");
        if (body.pid == "undefined"
            || body.pid == null
            || !numReg.test(body.pid)) {
            errList.push("Invalid Post ID! Post ID must be a number!");
        }

        if (body["replyTo"]) {
            //validate replyTo
            Log.inform("Valiating Comment [replyTo]");
            console.log(typeof body.replyTo)
            if (body.replyTo != null
                && !numReg.test(body.replyTo)
                && String(body.replyTo).trim() != "null") {
                errList.push("Invalid [replyTo]! [replyTo] must be a number or null!");
            }else if(String(body.replyTo).trim() === "null"){
                body.replyTo = null;
            }
        }

        //validate comment
        Log.inform("Valiating Comment comment body!");
        if (body.comment == "undefined"
            || body.comment == null
            || !strReg.test(body.comment)
            || body.comment.length > 200) {
            errList.push("Invalid Comment! Comment must be a string no more than 200 characters!");
        }

        return errList;
    }

    /**
     * this method is for handling 500 error responses using the Express Response
     * Object. A specific message is logged as well.
     * 
     * @param {Response} res - Express Response Object
     * @param {Error} err - Error Object to be returned
     * @param {String} msg - Friendly error message summary
     * @returns {Response}
     */
    handle500Error(res, err, msg) {
        let response = new RestResponse()
        Log.error(err.message ? err.message : JSON.stringify(err));
        res.status(500);
        response.status = 500;
        response.state = "failed";
        response.message = msg;
        response.err = {
            message: err.message,
            err: err.name.toLowerCase().includes("sequelize" || "sql" || "query") ? new Error(err.message) : err
        };
        return res.json(response)
    }

    /**
     * this method is for handling not found error responses using the Express Response
     * Object. A specific message is logged as well.
     * 
     * @param {Response} res - Express Response Object
     * @param {Error} err - Error Object to be returned
     * @param {String} msg - Friendly error message summary
     * @returns {Response}
     */
    handle404Error(res, err, msg) {
        let response = new RestResponse()
        Log.error(err.message ? err.message : JSON.stringify(err));
        res.status(404);
        response.status = 404;
        response.state = "notfound";
        response.message = msg;
        response.err = {
            message: err.message,
            err: err
        };
        return res.json(response)
    }

    /**
     * This is a checker method to check if a comment exists or not.
     * @param {Number} id - Comment ID 
     * @returns {Boolean} - If the comment exists or not
     */
    async doesCommentExist(id) {
        let numReg = /[0-9]/;

        if(cache.has("comment-" + id)){
            Log.inform("Comment found in cache.")
            return true
        }

        //validate Comment ID
        Log.inform("Valiating Comment ID!");
        if (id == "undefined"
            || id == null
            || !numReg.test(id)) {
            Log.error("Invalid Comment ID! Comment ID must be a number!");
            return false;
        }

        try {
            let dbRes = await this.commentServcie.getComment(id)

            if (dbRes == null || dbRes == "undefined" || dbRes.length < 1) {
                Log.warn("Comment doesn't exist")
                return false;
            }

            cache.set("comment-" + id, dbRes[0], 3600)
            return true;

        } catch (err) {
            Log.error(err.message)
            Log.error("There was an issue trying to find Comment with ID: " + id)
            return false;
        }

    }

    /**
     * This is a checker method to check if a post exists or not.
     * @param {Number} id - Post ID 
     * @returns {Boolean} - If the post exists or not
     */
    async doesPostExist(id) {
        let numReg = /[0-9]/;

        if(cache.has("post-" + id)){
            Log.inform("Post found in cache.")
            return true
        }

        //validate Post ID
        Log.inform("Valiating Post ID!");
        if (id == "undefined"
            || id == null
            || !numReg.test(id)) {
            Log.error("Invalid Post ID! Post ID must be a number!");
            return false;
        }

        try {
            let dbRes = await this.commentServcie.getPost(id)

            if (dbRes == null || dbRes == "undefined" || dbRes.length < 1) {
                return false;
            }

            cache.set("post-" + id, dbRes[0], 3600)
            return true;

        } catch (err) {
            Log.error(err.message)
            Log.error("There was an issue trying to find Post with ID: " + id)
            return false;
        }

    }

    /**
     * This is the controller method resposible for registering a comment into the database.
     * A ResponseObject is returned with status 200 and the comment object, if successful.
     * A ResponseObject is returned with status 404 and a message, if the post or replyTo 
     * comment doesn't exist.
     * A ResponseObject is returned with status 500 and a message, if an issue was 
     * encountered. 
     * @param {Request} req - Express Request Object
     * @param {Response} res - Express Response Object
     * @returns {Response} res - Express Response Object
     */
    async registerComment(req, res) {
        let { body } = req;

        body = this.sanitizeCommentObject(body)
        let errMsg = this.validateCommentBody(body);
        let response = new RestResponse()

        if (errMsg.length > 0) {
            let err = new Error(JSON.stringify(errMsg))
            return this.handle500Error(res, err, "Validation Error!");
        }

        try {
            body.status = 1;

            Log.inform("Checking if Post with ID:" + body.pid + " exists")
            //Check if post exists and continue appropriately
            if (await !this.doesPostExist(body.pid)) {
                let err = new Error("Cannot Find Post with ID: " + body.pid);
                this.handle404Error(res, err, "404 No Comment Found!")
            }
            Log.success("Comment found! Can proceed with the reply.")

            if (body.replyTo != null || body.replyTo != "null") {
                Log.inform("Checking if comment with ID: " + body.replyTo + " exists!")

                //Check if comment exists and continue appropriately
                if (await !this.doesCommentExist(body.replyTo)) {
                    let err = new Error("Cannot Find Comment with ID: " + body.replyTo);
                    this.handle404Error(res, err, "404 No Comment Found!")
                }
                Log.success("Comment found! Can proceed with the reply.")
            }

            Log.inform("Attempting to add comment.")
            let dbRes = await this.commentServcie.addCommentData(body);

            if (dbRes == null || dbRes == "undefined") {
                let err = new Error("Something went wrong! Contact admin for information!");
                return this.handle500Error(res, err, "Internal Server Error!");
            }

            response.status = 200;
            response.state = "success";
            response.message = "Comment has been added successfully!";
            response.body = dbRes;
            Log.success("Comment has been added successfully!");
            res.status(response.status);
            return res.json(response);

        } catch (err) {
            Log.error(err.message)
            return this.handle500Error(res, err, "Internal Server Error!");
        }

    }

    /**
     * This is the controller method resposible for upating a comment in the database by id.
     * A ResponseObject is returned with status 200 and the comment object, if successful.
     * A ResponseObject is returned with status 404 and a message, if the comment, post or 
     * replyTo comment doesn't exist.
     * A ResponseObject is returned with status 500 and a message, if an issue was 
     * encountered.  
     * @param {Request} req - Express Request Object
     * @param {Response} res - Express Response Object
     * @returns {Response} res - Express Response Object
     */
    async updateComment(req, res) {
        let { body } = req;
        let { cid } = req.params;

        body = this.sanitizeCommentObject(body)
        let errMsg = this.validateCommentBody(body);
        let response = new RestResponse()

        if (errMsg.length > 0) {
            let err = new Error(JSON.stringify(errMsg))
            return this.handle500Error(res, err, "Validation Error!");
        }

        try {
            if (body.status) delete body.status;

            Log.inform("Checking if Post with ID:" + body.pid + " exists")
            //Check if post exists and continue appropriately
            if (await !this.doesPostExist(body.pid)) {
                let err = new Error("Cannot Find Post with ID: " + body.pid);
                this.handle404Error(res, err, "404 No Post Found!")
            }
            Log.success("Post found! Can proceed with the comment.")

            if (body.replyTo != null || body.replyTo != "null") {
                Log.inform("Checking if comment with ID: " + body.replyTo + " exists!")

                //Check if reply exists and continue appropriately
                if (await !this.doesCommentExist(body.replyTo)) {
                    let err = new Error("Cannot Find Comment with ID: " + body.replyTo);
                    this.handle404Error(res, err, "404 No Comment Found!")
                }
                Log.success("Comment found! Can proceed with the reply.")
            }

            //Check if comment exists and continue appropriately
            Log.inform("Checking if comment with ID: " + cid + " exists!")
            if (await !this.doesCommentExist(cid)) {
                let err = new Error("Cannot Find Comment with ID: " + cid);
                this.handle404Error(res, err, "404 No Comment Found!")
            }
            Log.success("Comment found! Can proceed with the update.")

            Log.inform("Attempting to update comment.")
            let dbRes = await this.commentServcie.updateComment(cid, body);

            if (dbRes == null || dbRes == "undefined") {
                let err = new Error("Something went wrong! Contact admin for information!");
                return this.handle500Error(res, err, "Internal Server Error!");
            }

            response.status = 200;
            response.state = "success";
            response.message = "Comment has been updated successfully!";
            response.body = dbRes;
            Log.success("Comment has been updated successfully!");
            res.status(response.status);
            return res.json(response);

        } catch (err) {
            Log.error(err.message)
            return this.handle500Error(res, err, "Internal Server Error!");
        }

    }

    /**
     * This is the controller method resposible for retreiving comments on a specific post.
     * Each comment has a string vaue of a list of replies related to that comment.
     * A ResponseObject is returned with status 200 and the list of comments, if successful.
     * A ResponseObject is returned with status 404 and a message, if the comment, post or 
     * replyTo comment doesn't exist.
     * A ResponseObject is returned with status 500 and a message, if an issue was 
     * encountered. 
     * @param {Request} req - Express Request Object
     * @param {Response} res - Express Response Object
     * @returns {Response} res - Express Response Object
     */
    async getComments(req, res) {

        let { pid } = req.params;

        let response = new RestResponse()

        try {
            
            Log.inform("Attempting to retrieve comments for post ", pid)
            let dbRes;
            if(cache.has("CL-" + pid)){
                dbRes = cache.get("CL-" + pid)
                Log.inform("Retrieved Comments list from cache!")
            }else{
                
                dbRes = await this.commentServcie.retrievePostComments(pid);

                if (dbRes == null || dbRes == "undefined") {
                    let err = new Error("Something went wrong! Contact admin for information!");
                    return this.handle500Error(res, err, "Internal Server Error!");
                }

                if (dbRes.length < 1) {
                    let err = new Error("Cannot find any Comment records!");
                    return this.handle404Error(res, err, "404 Comment Not Found!");
                }

                Log.inform("Caching Comments list!")
                cache.set("CL-" + pid, dbRes, 3600)
            }

            response.status = 200;
            response.state = "success";
            response.message = "Comments have been retrieved!";
            response.body = dbRes;
            Log.success("Comments have been retrieved!");
            res.status(response.status);
            return res.json(response);

        } catch (err) {
            Log.error(err.message)
            return this.handle500Error(res, err, "Internal Server Error!");
        }

    }

    /**
     * This is the controller method resposible for retreiving comments on a specific post.
     * Each comment has a string vaue of a list of replies related to that comment.
     * A ResponseObject is returned with status 200 and a message, if successful.
     * A ResponseObject is returned with status 404 and a message, if the comment doesn't exist.
     * A ResponseObject is returned with status 500 and a message, if an issue was 
     * encountered. 
     * @param {Request} req - Express Request Object
     * @param {Response} res - Express Response Object
     * @returns {Response} res - Express Response Object
     */
    async deleteComment(req, res) {
        let { cid } = req.params;

        let response = new RestResponse()

        try {

            // if(await !this.doesCommentExist(cid) == false){
            //     let err = new Error("Cannot find any Comment record!");
            //     return this.handle404Error(res, err, "404 Comment Not Found!");
            // }
            
            Log.inform("Attempting to delete comment.")
            let dbRes = await this.commentServcie.deleteComment(cid);

            if (dbRes == null || dbRes == "undefined") {
                let err = new Error("Something went wrong! Contact admin for information!");
                return this.handle500Error(res, err, "Internal Server Error!");
            }

            cache.del("comment-" + cid)

            response.status = 200;
            response.state = "success";
            response.message = "Comment has been delete successfully!";
            response.body = null;
            Log.success("Comment has been deleted successfully!");
            res.status(response.status);
            return res.json(response);

        } catch (err) {
            Log.error(err.message)
            return this.handle500Error(res, err, "Internal Server Error!");
        }

    }

}

module.exports = CommentController;