var debugB2p = false;
var debugConnector = false;
/**
 * Namespace
 * @author Martin Robinson
 * http://en.wikipedia.org/wiki/JSDoc
 */
var Beer2Peer = {

  /**
   * Réinitialise internal randomiser with random.org
   */
  fetchTrueRandomSeed : function(){
    new XMLHttpRequest();
    $.get('https://www.random.org/integers/?num=256&min=0&max=255&col=1&base=16&format=plain&rnd=new',function(data){
      Math.seedrandom(data);
    });
  },
  
  /**
   * Fetch bacon ipsum
   */
   fetchBaconIpsum : function(){
      $.get('https://baconipsum.com/api/?type=meat-and-filler',function(data){
        console.log(data);
      });
   },

  /**
   * generate random seed
   */
  generateSeed : function(){
    return btoa(Math.random());
  },
  
  /**
   * Hobbo communication websocket.
   * funk(data){} is the callback when you recieve a message
   */
  hobboConnector : function(url){
    /**
     * connect to the hub
     * funkOnMsg is the function to call on reception, will be called with data
     * funkOnOpen (optional) will be called when conneciton is ready
     * funkOnClose (optional) will be called whenb connection close
     */
    function hobbo(funkOnMsg,funkOnOpen,funkOnClose){
      var ws = new WebSocket(url);
      if (debugConnector){console.log(ws);}
      ws.onopen = function (){
        console.log('hobbo connected to %s',url);
        if (funkOnOpen){funkOnOpen();}
      };
      ws.onclose = function(){
        console.log('hobbo disconnected from %s',url);
        if (funkOnOpen){funkOnClose();}
      };
      ws.onmessage = function (event) {
        if (debugConnector){console.log('hobbo %s recieved %s',url,event.data);}
        funkOnMsg(JSON.parse(event.data));
      };
      
      /**
       * Send data througn websocket to the hub.
       */
      function _send(data){
        if (ws.readyState != 1)
          return false;
        if (debugConnector){console.log('hobbo %s sent %s',url,data);}
        ws.send(JSON.stringify(data));
        return true;
      };
      
      function _close(){
        ws.close();
      }
      
      return {
        send : _send,
        close : _close
      };
    }
    return hobbo;
  },
 
  /**
   * beer2peer network, everyone is talking on the channel but nobody understand each other.
   * you can announce() your self then everyone will have you registered (emulate autodiscovery)
   * you can also register(name,publickey) 
   * and you can sendTo(name,data) if he is already registered
   * 
   * name is your identity on the hub
   * connector is the hub connection
   * funk is the function that will be called on message reception
   * return an object {sendTo(name,val), announve(), me, register(username,publicKey)}
   */
  connect : function(name,seed,connector, funk){
    /**
     * Public key encryption and key generation using cryptico
     */
    var security = {
      generatePrivateKey : function(seed){return cryptico.generateRSAKey(seed, 1024);},
      generatePublicKey : function(privateKey){return cryptico.publicKeyString(privateKey);},
      crypt : function(data,publicKey){return cryptico.encrypt(data, publicKey).cipher;},
      decrypt : function(data,privateKey){return cryptico.decrypt(data, privateKey).plaintext;},
      hash : function(s){return SHA256(s);}
    };
    var _secretHash = security.hash(name);
    var _privateKey = security.generatePrivateKey(seed);
    var _publicKey = security.generatePublicKey(_privateKey);
    var _me = {
      who : _secretHash, 
      how : _publicKey
    }
    var _funk = funk;
    var _connected = false;
    var _directory = {};
    
    /**
     * add peer to the directory
     * require {who : sha256(name) , how : publickey}
     */
    function _register(jsonWhoHow){
      if (debugB2p){console.log('b2p %s register %s',name,jsonWhoHow);}
      _directory[jsonWhoHow.who] = {how : jsonWhoHow.how};
      if (debugB2p){console.log('b2p %s directory %s',name,_directory);}
    }
   
    /**
     * receive data from peer if data.who match sha256(name)
     */
    function _recv(data){
      if (debugB2p){console.log('b2p %s rx %s',name,data);}
      if (data){
        if (data.who && data.how && data.who != _secretHash){
          _register(data);
        }
        else if(data.who==_secretHash && data.what){
          _funk(security.decrypt(data.what,_privateKey));
        }
      }
      else{
        if (debugB2p){console.log(' b2p %s nothing',name);}
      }
    }
    
    function _toggleConnectionOn(){
      _connected = true;
    }
    
    function _toggleConnectionOff(){
      _connected = false;
    }
   
    /**
     * connection
     */
    var _connection = connector(_recv,_toggleConnectionOn,_toggleConnectionOff);
   
    /**
     * announce your public key on the network
     */
    function _announce(){
      _connection.send(_me);
    }
    
    /**
     * send data to a peer if he exist in your directory
     */
    function _sendTo(toWho, andWhat){
      if (debugB2p){console.log('b2p %s tx to %s val %s',name,toWho,andWhat);}
      if(_connected){
        if (toWho in _directory){
          _connection.send({
            who : toWho,
            what : security.crypt(andWhat,_directory[toWho].how)
          });
        }
      }
      else{
        console.log('b2p %s is not connected',name);
      }
    }
    
    function _sendToAll(andWhat){
      if(_connected){
        for (var hash in _directory){
          _sendTo(hash,andWhat);
        }
      }
      else{
        console.log('b2p %s is not connected',name);
      }
    }

    return {
      me : {who:name, how:_publicKey},
      announce : _announce,
      sendTo : function(toWho,andWhat){_sendTo(security.hash(toWho),andWhat);},
      sendToAll : _sendToAll,
      register : function(whoIs,howIs){_register({who:security.hash(whoIs),how:howIs});},
      registerMe : function(){_register({who : _secretHash , how : _publicKey})},
      reconnect : function(){_connection =  connector(_recv,_toggleConnectionOn,_toggleConnectionOff);},
      disconnect : function(){_connection.close();},
      connected : function(){_connected;}
    };
  }
};
/**
 * Preinit internal randomizer
 */
(function(){
  Math.seedrandom();
})();
