/**
 *                          ErrorMessage class
 * simple wrapper for errors and rejects
 */


class ErrorMessage {

    // Constructor - argument data will be the object containing the transaction data
    constructor(code, message = "unknown exeption", exceptionObj) {
        this.code = code;                                          
        this.message = message;
        this.exceptionObj = exceptionObj;                                    
                           
    }

   

}

module.exports.ErrorMessage = ErrorMessage;              