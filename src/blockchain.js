/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const ErrorMessageClass = require('./errormessage.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {
    /**
     * Time limit for message
     */
    static get TIME_LIMIT() { return 300; }
    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            let block = new BlockClass.Block({ data: 'Genesis Block' });
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        let self = this;
        return new Promise((resolve, reject) => resolve(self.height));
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        let self = this;
        return new Promise((resolve) => {
            //TODO: reject if address is null or  empty string?
            resolve(`${address}:${self._getNowInSeconds()}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {

            let verificationResult = await self._verify(message, address, signature);
            if (verificationResult.valid) {
                try {
                    let block = await self._addBlock(new BlockClass.Block({ address, signature, star }));
                    resolve(block);
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(verificationResult.error);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) =>
            resolve(self.chain.find(block => block.hash === hash))
        );
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            if (height < 0 || height >= self.chain.length) {
                resolve(null);
            }
            resolve(self.chain[height]);
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress(address) {
        let self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
            if (self.height) {
                for (let i = 1; i < self.chain.length; ++i) {

                    const dataPromise = self.chain[i].getBData();
                    dataPromise
                        .then(function (data) {
                            if (data.address === address) {
                                stars.push({ owner: data.address, star: data.star });
                            }
                        })
                        .catch(error => reject(error));
                }
                resolve(stars);
            } else {
                resolve(stars);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            for (let idx = 0; idx < self.chain.length; ++idx) {
                const block = self.chain[idx];
                const isLinkedProperly = (idx == 0) || (self.chain[idx - 1].hash === block.previousBlockHash);
                const isBlockValid = await block.validate();
                if (!isLinkedProperly || !isBlockValid) {
                    errorLog.push({ height: block.height, hash: block.hash, isLinkedProperly, isBlockValid });
                }
            }
            resolve(errorLog);
        });
    }

    
    /**
     * Extract time  in seconds from message and return it as int
     * @param {*} message string <WALLET_ADDRESS>:<DATE IN SECONDS>:starRegistry 
     * @returns time in seconds
     */
    _extractTimeFromMessage(message) {
        return parseInt(message.split(':')[1])
    }
    /**
     * check if {@time} is not older then 5 min
     * @param {*} time in second
     * @returns 
     */
    _isInTimeWindow(time) {
        let delta = this._getNowInSeconds() - time;
        return (Blockchain.TIME_LIMIT - delta) > 0;
    }
    /**
    * Return now() in seconds
    * @returns now in seconds
    */
    _getNowInSeconds() {
        return Math.floor(Date.now() / 1000)
    }
    /**
     * verify is  block can be added into chain or
     * @param {*} message 
     * @param {*} address 
     * @param {*} signature 
     */
    _verify(message, address, signature) {
        let self = this;
        return new Promise((resolve, reject) => {
            let timeFromMessage = self._extractTimeFromMessage(message);
            if (self._isInTimeWindow(timeFromMessage)) {
                if (bitcoinMessage.verify(message, address, signature)) {
                    resolve({ valid: true });
                } else {
                    resolve({ valid: false, error: new ErrorMessageClass.ErrorMessage('_verify', 'signature verification failed') });
                }
            } else {
                resolve({ valid: false, error: new ErrorMessageClass.ErrorMessage('_verify', `message is older than ${Blockchain.TIME_LIMIT}`) });
            }
        });
    }
    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            return self.validateChain()
                .then(errorList => {
                    if (errorList.length == 0) {
                        block.time = self._getNowInSeconds();
                        //Check if current block not Generic
                        if (self.height != -1) {
                            block.previousBlockHash = self.chain[self.height].hash;
                        }
                        block.height = self.height + 1;
                        block.hash = SHA256(JSON.stringify(block)).toString();
                        self.chain.push(block);
                        self.height++;
                        resolve(block);
                    } else {
                        reject(new ErrorMessageClass.ErrorMessage("_addBlock_chainValidation", "The block can not be added, the chain is tampered"));
                    }
                })
                .catch(error => new ErrorMessageClass.ErrorMessage("_addBlockErrorCode"));
        });
    }
}

module.exports.Blockchain = Blockchain;