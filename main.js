/**
 * Скрипт для клейма
 * @Author JanSergeev (telegram)
 * Donate: 0x9D278054C3e73294215b63ceF34c385Abe52768B
 * node main.js
 * Адрес токена - это смарт-контракт токена
 */
import Web3 from "web3";
import ethers from "ethers";
import * as accs from "./accs.js";
import * as fs from "fs";
import * as path from "path";

const __dirname = path.resolve();

// Базовые переменные

const gasMultiplier = 100; // во сколько раз выше слать baseFee (умножение на целое)
const gas = 5000000;
const gasPrice = ethers.BigNumber.from(100000000).mul(gasMultiplier);
const pool_fee = "10000";
const pool_price = 1.4;
const scan = "https://arbiscan.io/tx/";
const ERC20_ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/ERC20.json"), "utf8")
);
const CLAIM_ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/CLAIM.json"), "utf8")
);
const QUOTER_ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/QUOTER.json"), "utf8")
);
const ROUTER_ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/ROUTER.json"), "utf8")
);
const uni_router = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // UniV3 Router
const uni_quoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // UniV3 Quoter
const claimer = "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9"; // claimer
const token = "0x912ce59144191c1204e64559fe8253a0e49e6548"; // ARB 0x912ce59144191c1204e64559fe8253a0e49e6548
const token_2 = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"; // USDC

/**
 * --> Укажите rpc адрес вашего блокчейна <--
 * Список rpc нод (https://github.com/arddluma/awesome-list-rpc-nodes-providers можно искать тут)
 * wss://mainnet.infura.io/ws/v3/f90864bedd6249daae088f6cbb95877b - эфир
 * wss://arb-mainnet.g.alchemy.com/v2/zdJ4SqxHCv-RHbOR3luvHOJUiK7arSgE - арбитрум оне
 * wss://opt-mainnet.g.alchemy.com/v2/kj9_qSyCtERS5GcYAo-H8vxlJk-Cm7bM - оптимизм
 * wss://bsc-ws-node.nariox.org:443 - бск
 * wss://api.avax.network/ext/bc/C/ws - авакс
 * wss://polygon-mainnet.g.alchemy.com/v2/8HAVDObpZF6j4nknPStdngLT9PzXx4I4 - полигон
 * https://nova.arbitrum.io/rpc - арбитрум нова
 * wss://goerli.infura.io/ws/v3/f90864bedd6249daae088f6cbb95877b - гоерли
 */

const arb_rpc_list = [
  new Web3(
    "https://arb-mainnet.g.alchemy.com/v2/a3gddyg-QZsrorLULTsvQACmRtXb-exh"
  ),
  new Web3(
    "https://arb-mainnet.g.alchemy.com/v2/a3gddyg-QZsrorLULTsvQACmRtXb-exh"
  ),
  new Web3(
    "https://arb-mainnet.g.alchemy.com/v2/a3gddyg-QZsrorLULTsvQACmRtXb-exh"
  ),
  new Web3(
    "https://arb-mainnet.g.alchemy.com/v2/a3gddyg-QZsrorLULTsvQACmRtXb-exh"
  ),
  new Web3(
    "https://arb-mainnet.g.alchemy.com/v2/a3gddyg-QZsrorLULTsvQACmRtXb-exh"
  ),
  new Web3(
    "https://arb-mainnet.g.alchemy.com/v2/a3gddyg-QZsrorLULTsvQACmRtXb-exh"
  ),
];

const arb_rpc = arb_rpc_list[0];
const eth_rpc = new Web3(
  "wss://rpc.ankr.com/eth/ws/52da482aba946d6f780bed3b25aceb584b28989f36f771f855c61a3a9bb82648"
);

const contract_erc20 = new arb_rpc.eth.Contract(ERC20_ABI, token);
const contract_claimer = new arb_rpc.eth.Contract(CLAIM_ABI, claimer);
const contract_quoter = new arb_rpc.eth.Contract(QUOTER_ABI, uni_quoter);
const contract_router = new arb_rpc.eth.Contract(ROUTER_ABI, uni_router);

/**
 * Абстрактная задержка (async)
 * @param {Integer} millis
 * @returns
 */

const sleep = async (millis) =>
  new Promise((resolve) => setTimeout(resolve, millis));

/**
 * Случайное min/max целое значение
 * @param {Integer} min
 * @param {Integer} max
 * @returns Случайное число
 */

export const randomIntInRange = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const checkClaimable = async (address) => {
  try {
    await contract_claimer.methods.claim().estimateGas({ from: address });
    return true;
  } catch (e) {
    console.dir(e.message);
    await checkClaimable(address);
  }
};

const batchClaim = (acc, to_acc, numberOfTokens, signedTx, address) =>
  arb_rpc.eth.sendSignedTransaction.request(
    signedTx.rawTransaction,
    async (e, hash) =>
      new Promise(async (resolve, reject) => {
        if (!e) {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: клейм -> ${scan}${hash}`
          );
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => со старта прошло ${
              performance.now() - start
            }ms`
          );
          const getReceipt = async (hash) => {
            try {
              let receipt = await arb_rpc.eth.getTransactionReceipt(hash);
              if (!receipt) {
                await sleep(1000);
                return await getReceipt(hash);
              } else {
                return receipt;
              }
            } catch (e1) {
              await sleep(1000);
              return await getReceipt(hash);
            }
          };
          let receipt = await getReceipt(hash);
          if (!receipt.status) {
            console.log(
              `[${new Date().toUTCString()}] ArbiClaimer => ${address}: неудачный клейм..`
            );
            retrySend(acc, to_acc, numberOfTokens);
          } else {
            console.log(
              `[${new Date().toUTCString()}] ArbiClaimer => ${address}: успешный клейм!`
            );
          }
        } else {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: ошибка при клейме ->`
          );
          console.dir(e);
          retrySend(acc, to_acc, numberOfTokens);
        }
      })
  );

const batchUni = (acc, to_acc, numberOfTokens, signedTx, address) =>
  arb_rpc.eth.sendSignedTransaction.request(
    signedTx.rawTransaction,
    async (e, hash) =>
      new Promise(async (resolve, reject) => {
        if (!e) {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: обмен ${
              numberOfTokens / 10 ** 18
            } ARB -> ${scan}${hash}`
          );
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => со старта прошло ${
              performance.now() - start
            }ms`
          );
          const getReceipt = async (hash) => {
            try {
              let receipt = await arb_rpc.eth.getTransactionReceipt(hash);
              if (!receipt) {
                await sleep(1000);
                return await getReceipt(hash);
              } else {
                return receipt;
              }
            } catch (e1) {
              await sleep(1000);
              return await getReceipt(hash);
            }
          };
          let receipt = await getReceipt(hash);
          if (!receipt.status) {
            console.log(
              `[${new Date().toUTCString()}] ArbiClaimer => ${address}: неудачный обмен..`
            );
            uniRetrySend(acc, numberOfTokens);
          } else {
            console.log(
              `[${new Date().toUTCString()}] ArbiClaimer => ${address}: успешный обмен!`
            );
          }
        } else {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: ошибка при обмене ->`
          );
          console.dir(e);
          uniRetrySend(acc, numberOfTokens);
        }
      })
  );

const uniRetrySend = (acc, numberOfTokens, nonce = -1) =>
  new Promise(async (resolve, reject) => {
    let ethWallet = arb_rpc.eth.accounts.privateKeyToAccount(acc);
    let address = ethWallet.address;
    let gasPrice = ethers.BigNumber.from(100000000).mul(gasMultiplier);
    let usdcMinOutput = (numberOfTokens / 10 ** 18) * pool_price * 10 ** 6;
    let deadline = Math.floor(Date.now() / 1000 + 1800);
    const swap_prepare = contract_router.methods.exactInputSingle([
      token,
      token_2,
      pool_fee,
      address,
      deadline,
      numberOfTokens.toString(),
      String(usdcMinOutput),
      0,
    ]);
    const swap = await swap_prepare.encodeABI();
    let tx =
      nonce == -1
        ? {
            from: address,
            to: uni_router,
            gas,
            gasPrice: gasPrice.toString(),
            nonce: await arb_rpc.eth.getTransactionCount(address, "pending"),
            data: swap,
          }
        : {
            from: address,
            to: uni_router,
            gas,
            gasPrice: gasPrice.toString(),
            nonce,
            data: swap,
          };
    // Подписываем и отправляем
    let signedTx = await arb_rpc.eth.accounts.signTransaction(tx, acc);
    arb_rpc.eth
      .sendSignedTransaction(signedTx.rawTransaction)
      .on("transactionHash", async (hash) => {
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => ${address}: обмен ${
            numberOfTokens / 10 ** 18
          } ARB -> ${scan}${hash}`
        );
        const getReceipt = async (hash) => {
          try {
            let receipt = await arb_rpc.eth.getTransactionReceipt(hash);
            if (!receipt) {
              await sleep(1000);
              return await getReceipt(hash);
            } else {
              return receipt;
            }
          } catch (e1) {
            await sleep(1000);
            return await getReceipt(hash);
          }
        };
        let receipt = await getReceipt(hash);
        if (!receipt.status) {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: неудачный обмен (retry)..`
          );
          uniRetrySend(acc, numberOfTokens);
        } else {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: успешный обмен!`
          );
        }
      })
      .on("error", async (error) => {
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => ${address}: ошибка при обмене (retry) ->`
        );
        console.dir(error);
        if (nonce == -1) {
          uniRetrySend(acc, numberOfTokens);
        }
      });
  });

const trasnferRetrySend = (acc, to_acc, numberOfTokens, nonce = -1) =>
  new Promise(async (resolve, reject) => {
    // Отправка на биржу
    let ethWallet = arb_rpc.eth.accounts.privateKeyToAccount(acc);
    let address = ethWallet.address;
    let tx =
      nonce == -1
        ? {
            from: address,
            to: token,
            gas: gas,
            gasPrice: gasPrice.toString(),
            nonce:
              (await arb_rpc.eth.getTransactionCount(address, "pending")) + 1,
            data: await contract_erc20.methods
              .transfer(to_acc, numberOfTokens.toString())
              .encodeABI(),
          }
        : {
            from: address,
            to: token,
            gas: gas,
            gasPrice: gasPrice.toString(),
            nonce,
            data: await contract_erc20.methods
              .transfer(to_acc, numberOfTokens.toString())
              .encodeABI(),
          };
    let signedTx = await arb_rpc.eth.accounts.signTransaction(tx, acc);
    arb_rpc.eth
      .sendSignedTransaction(signedTx.rawTransaction)
      .on("transactionHash", (hash) => {
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => ${address}: отправка ARB на биржу -> ${scan}${hash}`
        );
      })
      .on("error", async (error) => {
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => ${address}: ошибка при трансфере ->`
        );
        console.dir(error);
        if (nonce == -1) {
          trasnferRetrySend(
            acc,
            to_acc,
            await contract_erc20.methods.balanceOf(address).call()
          );
        }
      });
  });

const retrySend = (acc, to_acc, numberOfTokens, nonce = -1) =>
  new Promise(async (resolve, reject) => {
    // Кошелек
    let ethWallet = arb_rpc.eth.accounts.privateKeyToAccount(acc);
    let address = ethWallet.address;
    let tx = {
      from: address,
      to: claimer,
      gas,
      gasPrice: gasPrice.toString(),
      nonce: await arb_rpc.eth.getTransactionCount(address, "pending"),
      data: await contract_claimer.methods.claim().encodeABI(),
    };
    // Подписываем и отправляем
    let signedTx = await arb_rpc.eth.accounts.signTransaction(tx, acc);

    arb_rpc.eth
      .sendSignedTransaction(signedTx.rawTransaction)
      .on("transactionHash", async (hash) => {
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => ${address}: клейм -> ${scan}${hash}`
        );
        const getReceipt = async (hash) => {
          try {
            let receipt = await arb_rpc.eth.getTransactionReceipt(hash);
            if (!receipt) {
              await sleep(1000);
              return await getReceipt(hash);
            } else {
              return receipt;
            }
          } catch (e1) {
            await sleep(1000);
            return await getReceipt(hash);
          }
        };
        let receipt = await getReceipt(hash);
        if (!receipt.status) {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: неудачный клейм..`
          );
          retrySend(acc, to_acc, numberOfTokens);
        } else {
          console.log(
            `[${new Date().toUTCString()}] ArbiClaimer => ${address}: успешный клейм!`
          );
        }
      })
      .on("error", async (error) => {
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => ${address}: ошибка при клейме (retry) ->`
        );
        console.dir(error);
        retrySend(acc, to_acc, numberOfTokens);
      });
  });

// govno code prepare signed txns in batch
const prepareBatch = (acc, to_acc, numberOfTokens, rpcBatch, nonce = -1) =>
  new Promise(async (resolve, reject) => {
    // Кошелек
    let ethWallet = arb_rpc.eth.accounts.privateKeyToAccount(acc);
    let address = ethWallet.address;
    let tx = {
      from: address,
      to: claimer,
      gas,
      gasPrice: gasPrice.toString(),
      data: await contract_claimer.methods.claim().encodeABI(),
    };
    // Подписываем и отправляем
    let signedTx = await arb_rpc.eth.accounts.signTransaction(tx, acc);

    let usdcMinOutput = (numberOfTokens / 10 ** 18) * pool_price * 10 ** 6;
    let deadline = Math.floor(Date.now() / 1000 + 1800);
    const swap_prepare = contract_router.methods.exactInputSingle([
      token,
      token_2,
      pool_fee,
      address,
      deadline,
      numberOfTokens.toString(),
      String(usdcMinOutput),
      0,
    ]);
    const swap = await swap_prepare.encodeABI();
    let tx_2 =
      nonce == -1
        ? {
            from: address,
            to: uni_router,
            gas,
            gasPrice: gasPrice.toString(),
            nonce:
              (await arb_rpc.eth.getTransactionCount(address, "pending")) + 1,
            data: swap,
          }
        : {
            from: address,
            to: uni_router,
            gas,
            gasPrice: gasPrice.toString(),
            nonce,
            data: swap,
          };
    // Подписываем и отправляем
    let signedTx_2 = await arb_rpc.eth.accounts.signTransaction(tx_2, acc);
    rpcBatch.add(batchClaim(acc, to_acc, numberOfTokens, signedTx, address));
    rpcBatch.add(batchUni(acc, to_acc, numberOfTokens, signedTx_2, address));
    console.log(
      `[${new Date().toUTCString()}] ArbiClaimer => ${address}: партия транзакций подготовлена`
    );
    // console.log(
    //   `[${new Date().toUTCString()}] ArbiClaimer => ${address}: ${
    //     (await contract_erc20.methods.allowance(address, uni_router).call()) ==
    //     0
    //       ? "НЕТ РАЗРЕШЕНИЯ НА РАСХОДОВАНИЕ"
    //       : "разрешение на расходование есть"
    //   }`
    // );
    resolve();
  });

// Чтение аккаунтов

const adata = await accs.importETHWallets();
const senddata = await accs.importSendWallets();
const nonces = [];
const bals = [];
const batches = arb_rpc_list.map((rpc) => new rpc.BatchRequest());
let start = 0;
for (let acc of adata) {
  // Кошелек
  let ethWallet = arb_rpc.eth.accounts.privateKeyToAccount(acc);
  let address = ethWallet.address;
  nonces.push((await arb_rpc.eth.getTransactionCount(address, "pending")) + 1);
  bals.push(await contract_claimer.methods.claimableTokens(address).call());
}
// govno code
let batchN = 0;
for (let i = 0; i < adata.length; i++) {
  await prepareBatch(
    adata[i],
    senddata[i],
    bals[i],
    batches[batchN],
    nonces[i]
  );
  if (batchN == batches.length - 1) {
    batchN = 0;
  } else {
    batchN++;
  }
}
// for check claimable
let ethWallet = arb_rpc.eth.accounts.privateKeyToAccount(adata[0]);
let address = ethWallet.address;
eth_rpc.eth.subscribe("newBlockHeaders", async (err, res) => {
  if (!err) {
    console.log(
      `${new Date().toUTCString()}] ArbiClaimer => block: ${
        res.number
      }, eth baseFee: ${ethers.utils.formatUnits(
        res.baseFeePerGas,
        "gwei"
      )} gwei`
    );
    if (res.number >= 16890400) {
      new Promise(async (resolve, reject) => {
        eth_rpc.eth.clearSubscriptions();
        await checkClaimable(address);
        start = performance.now();
        for (let batch of batches) {
          batch.execute();
        }
        console.log(
          `[${new Date().toUTCString()}] ArbiClaimer => со старта прошло ${
            performance.now() - start
          }ms`
        );
      });
    }
  }
});
