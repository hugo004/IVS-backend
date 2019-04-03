# ivs-network

information verification system network

### Clear docker previous setup
```
    docker kill $(docker ps -q)
    docker rm $(docker ps -aq)
    docker rmi $(docker images dev-* -q)
```

### Generate new bna file when the js, cto, acl updated
```
 composer archive create -t dir -n .
```

### Deploy business network
```
 composer network install --card PeerAdmin@hlfv1 --archiveFile ivs-network@0.0.1.bna
 ```

 ### Start business network
 ```
composer network start --networkName ivs-network --networkVersion 0.0.1 --networkAdmin admin --networkAdminEnrollSecret adminpw --card PeerAdmin@hlfv1 --file networkadmin.card

//--file networkadmin.card would create the file .card
 ```

 ### Import network admin card for identity
 ```
 composer card import --file networkadmin.card

//card delete command
 composer card delete --card admin@ivs-network
 ```

 ### Check businees network has been deployed successfully
 ```
composer network ping --card admin@ivs-network
 ```

 ---
 ### Start restful server
 ```
 composer-rest-server

 //name is the network card name: admin@ivs-network
 ```

 ---
 ### Upgrade business network
 ```
1. change package.json version number (e.g 0.0.1 -> 0.0.2)

2. composer archive create -t dir -n .

3. composer network install -a ivs-network@0.0.2.bna -c peeradmin@hlfv1 //ivs-network@new_version.bna

4. composer network upgrade -c peeradmin@hlfv1 -n ivs-network -V 0.0.2 //new version number
 ```

 ### Reset business network
 ```
 composer network reset -c admin@ivs-network
 ```
 