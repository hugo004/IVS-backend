const host = 'localhost';

module.exports = {
  'secret': 'secret',
  'recordType': ['Education', 'WorkExp', 'Volunteer', 'Other'],

  connectionProfile: {
    "name": "hlfv1",
    "x-type": "hlfv1",
    "x-commitTimeout": 300,
    "version": "1.0.0",
    "client": {
        "organization": "Org1",
        "connection": {
            "timeout": {
                "peer": {
                    "endorser": "300",
                    "eventHub": "300",
                    "eventReg": "300"
                },
                "orderer": "300"
            }
        }
    },
    "channels": {
        "composerchannel": {
            "orderers": [
                "orderer.example.com"
            ],
            "peers": {
                "peer0.org1.example.com": {
                    // "endorsingPeer": true,
                    // "chaincodeQuery": true,
                    // "ledgerQuery": true,
                    // "eventSource": true
                }
            }
        }
    },
    "organizations": {
        "Org1": {
            "mspid": "Org1MSP",
            "peers": [
                "peer0.org1.example.com"
            ],
            "certificateAuthorities": [
                "ca.org1.example.com"
            ]
        }
    },
    "orderers": {
        "orderer.example.com": {
            "url": `grpc://${host}:7050`
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": `grpc://${host}:7051`
        }
    },
    "certificateAuthorities": {
        "ca.org1.example.com": {
            "url": `http://${host}:7054`,
            "caName": "ca.org1.example.com"
        }
    }
  }
}
