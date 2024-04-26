/* External Imports */
// const { ethers, network,} = require('hardhat')
const { ethers, getChainId, upgrades, network } = require('hardhat')
const { utils } = require('ethers')
const chai = require('chai')
const { solidity } = require('ethereum-waffle')
const { expect, assert } = chai

const {
  deployContract,
  deployUpgradeContract,
  isContractTransferSuccess
} = require('../scripts/utils/helper')

chai.use(solidity)

describe(`main process`, () => {

  let usdtContract,soulContract,campaignsServiceContract,nftCarvProtocolContract;
  let deployer, partner, user, tee,v1,v2,v3,v4,v5;
  const campaign_id = "bd0078f7-4a48-5764-92bf-353ccbcea6e2"
  const amount = 200
  const num_limited = 10
  let totalSupply = 100000000000000

  before(`deploy contact and setting `, async () => {

    let chainID = await getChainId();
    [deployer,partner,user,tee,v1,v2,v3,v4,v5] =  await ethers.getSigners();

    console.log("chainID is :" + chainID);
    console.log("deployer   :" + deployer.address);
    console.log("partner    :" + partner.address);
    console.log("user       :" + user.address);
    console.log("tee        :" + tee.address);
    console.log("v1         :" + v1.address);
    console.log("v2         :" + v2.address);
    console.log("v3         :" + v3.address);
    console.log("v4         :" + v4.address);
    console.log("v5         :" + v5.address);
  
    usdtContract = await deployContract(partner, "TestERC20", "USDT", "USDT", totalSupply);
    soulContract = await deployContract(deployer, "TestERC20", "SOUL", "SOUL", totalSupply);

    campaignsServiceContract = await deployUpgradeContract(
      deployer, "CarvProtocolService",usdtContract.address
    );

    nftCarvProtocolContract = await deployUpgradeContract(
      deployer, "CarvProtocolNFT","CarvProtocolNFT","CNT"
    );

    let isSucess = await isContractTransferSuccess(
      await usdtContract.connect(partner).approve(campaignsServiceContract.address,amount)
    )
    console.log("approve is ",isSucess);

    isSucess = await isContractTransferSuccess(
      await campaignsServiceContract.connect(deployer).set_pay_address(soulContract.address)
    )
    console.log("set_pay_address is ",isSucess);

    isSucess = await isContractTransferSuccess(
      await soulContract.connect(deployer).approve(campaignsServiceContract.address,amount * 100)
    )
    console.log("transfer is ",isSucess);

    isSucess = await isContractTransferSuccess(
      await campaignsServiceContract.set_nft_address(nftCarvProtocolContract.address)
    );
    console.log("set_nft_address is ",isSucess);

    isSucess = await isContractTransferSuccess(
      await campaignsServiceContract.set_verifier_pass_threshold(2)
    );
    console.log("set_verifier_pass_threshold is ",isSucess);


  })

  async function submit_campaign() {

    
    let requirementsJson = 
    [
      { 
        "ID":[
          {          
            "Type": "Email",
            "ID":"*",
            "Verifier": "CliqueCarv",
            "Rule": "Unique",
          },{
            "Type": "Steam",
            "ID":"<RE>",
            "Verifier": "CliqueCarv",
            "Rule": "Unique",
          }
        ],
        "Data":[{
          "Type":"Achieve",
          "Data":{"game":"xxxx"}
          }
        ],
        "Actions":[
          "SendEMail","Callback Uri"
        ],
        "Rewards":[ 
          {"Soul":500}
        ],
        "Limits":{
          "Count":10,
          "StartTime":123456,
          "EndTime":123456
        }
      }
    ];
  
    let compaign_info = {
      campaign_id: campaign_id,
      url:"http://ipfs",
      creator: partner.address,
      campaign_type: 0,
      
      reward_contract: usdtContract.address,
      reward_total_amount: amount,
      reward_count: num_limited,
      status: 0,
      start_time: 1690874219888,
      end_time: 1690874219888,
      requirements: JSON.stringify(requirementsJson)
    }
  
    let reward_info = {
      campaign_id: campaign_id,
      user_address: deployer.address,
      reward_amount: amount,
      total_num: num_limited,
      contract_address: usdtContract.address,
      contract_type: 1
    }
  
    let isSucess = await isContractTransferSuccess(
      await campaignsServiceContract.connect(partner).submit_campaign(
        reward_info,compaign_info
      )
    )
    return isSucess;
  }

  it('1.Parnter provides Campaign data and pays reward USDT (ERC20)', async function () {

    let isSucess = await submit_campaign();
    assert.equal(true,isSucess);

    let rewardBalance = await usdtContract.balanceOf(deployer.address)
    assert.equal(rewardBalance.toString(), amount.toString())

  })

  const MultiUserIDs = [
    {
      "userID": "openID2:steam:a000000000000000000000000000000000000000000000000000000000000001",
      "verifierUri1": "https://carv.io/verify/steam/a000000000000000000000000000000000000000000000000000000000000001",
      "memo": "memo1"
    },
    {
      "userID": "did:polgyonId:b000000000000000000000000000000000000000000000000000000000000002",
      "verifierUri1": "https://carv.io/verify/steam/b000000000000000000000000000000000000000000000000000000000000002",
      "memo": "memo1"
    }
  ]

  it('2.tee set identities root case', async function () {

    let new_user_profile = "ipsf://abc02"
    let new_profile_verison = 1

    // 
    const dataHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(JSON.stringify(MultiUserIDs))
    );
    const dataHashBin = ethers.utils.arrayify(dataHash);
    const ethHash = ethers.utils.hashMessage(dataHashBin);

    const signature = await tee.signMessage(dataHashBin);

    let userIDS = new Array();
    MultiUserIDs.forEach(
      (MultiUserIDObj) => {
        userIDS.push(MultiUserIDObj.userID)
      }
    )

    // console.log("------------ xxl set_identities_root");
    let isSucess = await isContractTransferSuccess(
      await campaignsServiceContract.connect(tee).set_identities_root(
        user.address, new_user_profile, new_profile_verison, ethHash, signature)
        // user.address, tee.address, new_user_profile, new_profile_verison, ethHash, userIDS, signature)
    )

    if (isSucess) {
      return_profile = await campaignsServiceContract.get_user_by_address(user.address)

      assert.equal(new_user_profile, return_profile[1])
      assert.equal(new_profile_verison, return_profile[2])

    } else {
      console.log("set_identities_root error ");
    }

  })


  it('3.user submit data for campaign', async function() {
    let requirementsJson = [
      {
        Owner: "xxxx",
        ID:[
          {
            ID: "xxxxxx",
            Type: "Web2Account",
            Provider: "Steam",
            Owner: "xxx",
            Verifier: "Carv",
            Signature: "xxxxxx"
          },
          {
            ID: "xxx@gmail.com",
            Type: "Email",
            Provider: "Gmail",
            Owner: "xxx",
            Verifier: "Clique",
            Signature: "xxxxx"
          }
        ],
        Data: [
          {
            ID: "xxxxxx",
            Type: "Web2Account",
            Provider: "Steam",
            DataType: "Achievement",
            Content: {
              game: "xxxxxx",
              title: "xxxxxx",
              timestamp: "xxxxxxxx"
            },
            Verifier: "Carv",
            Signature: "xxxxxxx"
          }
        ],
        RewardAddress: [
          "AddressA"
        ],
        OwnerSig: "xxxxxx"
      }
    ]
    let isSucess = await isContractTransferSuccess(
      await campaignsServiceContract.connect(user).join_campaign(
        0,campaign_id, JSON.stringify(requirementsJson)
      )
    )
    assert.equal(true,isSucess);
  })

  // function report_tee_attestation(string calldata campaign_id,string calldata attestation) external only_tees{ 
  it('4.TEE report tee attestation', async function () {

    let isSucess = await isContractTransferSuccess(

      await campaignsServiceContract.connect(deployer).add_tee_role(tee.address),
      await campaignsServiceContract.connect(tee).report_tee_attestation(
        campaign_id,"xyz 1234")
    )

    if (isSucess) {
      let proofs = await campaignsServiceContract.get_proof_list()
      // console.log(proofs);
      assert.equal(proofs[0], "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b")
    }

  })
  

  it('5.verifier verify attestation : false', async function () {


    let isSucess = await isContractTransferSuccess(

      await campaignsServiceContract.connect(deployer).add_verifier_role(deployer.address),
      await campaignsServiceContract.connect(deployer).verify_attestation(
        "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b",true),
    )

    if (isSucess) {
      let result = await campaignsServiceContract.get_attestation_result(
          "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b"
      )
      assert.equal(result,false);
    }
  })

  it('6.verifier verify attestation : true', async function () {


    let isSucess = await isContractTransferSuccess(

      // await campaignsServiceContract.connect(deployer).add_verifier_role(deployer.address),
      // await campaignsServiceContract.connect(deployer).verify_attestation(
      //   "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b",true),
      await nftCarvProtocolContract.mint(v1.address,1),  
      await campaignsServiceContract.connect(v1).verify_attestation(
        "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b",true),
    )

    if (isSucess) {
      let result = await campaignsServiceContract.get_attestation_result(
          "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b"
      )
      assert.equal(result,true);
    }
  })

  it('7.verifier verify the same attestation ', async function () {


    let isSucess = await isContractTransferSuccess(

      await campaignsServiceContract.connect(deployer).add_verifier_role(deployer.address),
      await campaignsServiceContract.connect(deployer).verify_attestation(
        "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b",true),
    )


    if (isSucess) {
      await campaignsServiceContract.connect(deployer).verify_attestation(
        "0x04687ed6a16affd383bc95916f149ff3098584a0ab1f746f894a52d79c72262b",true)
    }

  })

})
