(function () {
    // Define allowed origin
    const ALLOWED_ORIGIN = 'https://najime.org';
    const isParent = !window.parent || window.parent === window;

    // Define nmaapi object
    const nmaapi = {
        async sendTransaction(amount, network, address, token = null) {
            if (isParent) {
                // Parent context: Execute transaction directly
                return await executeTransaction(amount, network, address, token);
            } else {
                // Child context: Send transaction request via postMessage
                return await sendTransactionRequest(amount, network, address, token);
            }
        }
    };

    // Expose nmaapi globally
    window.nmaapi = nmaapi;
    console.log(`${isParent ? 'Parent' : 'Child'} context: nmaapi defined`, !!window.nmaapi);

    // Parent context: Initialize and notify child
    if (isParent) {
        window.addEventListener('load', () => {
            const iframe = document.querySelector('iframe');
            if (!iframe || !iframe.contentWindow) {
                console.error('Iframe or contentWindow not available');
                return;
            }
            try {
                console.log('Parent: Sending NMAAPI_READY to:', ALLOWED_ORIGIN);
                iframe.contentWindow.postMessage({ type: 'NMAAPI_READY' }, ALLOWED_ORIGIN);
                setTimeout(() => {
                    console.log('Parent: Retrying NMAAPI_READY to:', ALLOWED_ORIGIN);
                    iframe.contentWindow.postMessage({ type: 'NMAAPI_READY' }, ALLOWED_ORIGIN);
                }, 1000);
                setTimeout(() => {
                    console.log('Parent: Retrying NMAAPI_READY (2nd) to:', ALLOWED_ORIGIN);
                    iframe.contentWindow.postMessage({ type: 'NMAAPI_READY' }, ALLOWED_ORIGIN);
                }, 3000);
            } catch (error) {
                console.error('Parent: Failed to send NMAAPI_READY:', error.message);
            }
        });

        // Listen for transaction requests from child
        window.addEventListener('message', async (event) => {
            if (event.origin !== ALLOWED_ORIGIN) {
                console.warn('Parent: Message from untrusted origin:', event.origin, 'Expected:', ALLOWED_ORIGIN);
                return;
            }

            if (event.data.type === 'TRANSACTION_REQUEST') {
                console.log('Parent: Received TRANSACTION_REQUEST:', event.data.payload);
                try {
                    const { amount, network, address, token } = event.data.payload;
                    const result = await executeTransaction(amount, network, address, token);
                    console.log('Parent: Sending TRANSACTION_RESPONSE:', { success: true, transactionId: result });
                    event.source.postMessage({
                        type: 'TRANSACTION_RESPONSE',
                        payload: { success: true, transactionId: result }
                    }, ALLOWED_ORIGIN);
                } catch (error) {
                    console.error('Parent: Message handler error:', error.message);
                    event.source.postMessage({
                        type: 'TRANSACTION_RESPONSE',
                        payload: { success: false, error: error.message }
                    }, ALLOWED_ORIGIN);
                }
            }
        });
    } else {
        // Child context: Wait for NMAAPI_READY
        let isNmaapiReady = false;
        window.addEventListener('message', (event) => {
            if (event.origin !== ALLOWED_ORIGIN) {
                console.warn('Child: Message from untrusted origin:', event.origin, 'Expected:', ALLOWED_ORIGIN);
                return;
            }
            if (event.data.type === 'NMAAPI_READY') {
                isNmaapiReady = true;
                console.log('Child: Received NMAAPI_READY, nmaapi available:', !!window.nmaapi);
            }
        });

        // Periodically check for readiness
        const checkNmaapi = setInterval(() => {
            if (isNmaapiReady) {
                console.log('Child: nmaapi ready via interval check');
                clearInterval(checkNmaapi);
            }
        }, 500);
    }

    // Execute transaction (parent only)
    async function executeTransaction(amount, network, address, token = null) {
        console.log('Executing transaction:', { amount, network, address, token });
        try {
            if (!amount || isNaN(amount) || amount <= 0) {
                throw new Error('Invalid amount');
            }
            if (!address || typeof address !== 'string' || !address.trim()) {
                throw new Error('Invalid recipient address');
            }
            if (token && (typeof token !== 'string' || !token.match(/^0x[a-fA-F0-9]{40}$/))) {
                throw new Error('Invalid token address');
            }

            if (network === 'Solana') {
                return await handleSolanaTransaction(amount, address);
            } else if (network === 'Ethereum') {
                return await handleEthereumTransaction(amount, address, token);
            } else if (network === 'BNB') {
                return await handleBNBTransaction(amount, address, token);
            } else {
                throw new Error('Unsupported network');
            }
        } catch (error) {
            console.error('Transaction error:', error.message);
            throw error;
        }
    }

    // Send transaction request (child only)
    function sendTransactionRequest(amount, network, address, token) {
        return new Promise((resolve, reject) => {
            if (!window.parent) {
                reject(new Error('Parent window not accessible'));
                return;
            }
            if (!isNmaapiReady) {
                reject(new Error('Wallet API not ready'));
                return;
            }

            console.log('Child: Sending TRANSACTION_REQUEST:', { amount, network, address, token });
            window.parent.postMessage({
                type: 'TRANSACTION_REQUEST',
                payload: { amount, network, address, token }
            }, ALLOWED_ORIGIN);

            window.addEventListener('message', function handler(event) {
                if (event.origin !== ALLOWED_ORIGIN) {
                    console.warn('Child: Response from untrusted origin:', event.origin);
                    return;
                }
                if (event.data.type === 'TRANSACTION_RESPONSE') {
                    console.log('Child: Received TRANSACTION_RESPONSE:', event.data.payload);
                    const { success, transactionId, error } = event.data.payload;
                    if (success) {
                        resolve(transactionId);
                    } else {
                        reject(new Error(error));
                    }
                    window.removeEventListener('message', handler);
                }
            });
        });
    }

    // Solana Transaction (Phantom Wallet, Devnet)
    async function handleSolanaTransaction(amount, address) {
        if (!window.solana || !window.solana.isPhantom) {
            throw new Error('Phantom wallet not detected');
        }
        if (!address.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
            throw new Error('Invalid Solana address');
        }

        const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');
        await window.solana.connect();
        const publicKey = new solanaWeb3.PublicKey(window.solana.publicKey.toString());
        const recipient = new solanaWeb3.PublicKey(address);

        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: recipient,
                lamports: BigInt(amount * solanaWeb3.LAMPORTS_PER_SOL)
            })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signed = await window.solana.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature);
        return signature;
    }

    // Ethereum Transaction (MetaMask, Sepolia Testnet)
    async function handleEthereumTransaction(amount, address, token) {
        if (!window.ethereum) {
            throw new Error('MetaMask not detected');
        }
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error('Invalid Ethereum address');
        }

        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send('eth_requestAccounts', []);
            const signer = provider.getSigner();

            console.log('Switching to Sepolia Testnet, chainId: 0xaa36a7');
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }]
            });

            if (token) {
                const tokenContract = new ethers.Contract(token, [
                    'function transfer(address to, uint256 amount) public returns (bool)'
                ], signer);
                const decimals = 18;
                const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
                const tx = await tokenContract.transfer(address, amountInWei);
                await tx.wait();
                return tx.hash;
            } else {
                const tx = {
                    to: address,
                    value: ethers.utils.parseEther(amount.toString())
                };
                const transaction = await signer.sendTransaction(tx);
                await transaction.wait();
                return transaction.hash;
            }
        } catch (error) {
            console.error('Ethereum transaction error:', error.message);
            throw new Error('Failed to process Ethereum transaction: ' + error.message);
        }
    }

    // BNB Transaction (MetaMask, BNB Testnet)
    async function handleBNBTransaction(amount, address, token) {
        if (!window.ethereum) {
            throw new Error('MetaMask not detected');
        }
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error('Invalid BNB address');
        }

        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send('eth_requestAccounts', []);
            const signer = provider.getSigner();

            console.log('Switching to BNB Testnet, chainId: 0x61');
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x61' }]
            });

            if (token) {
                const tokenContract = new ethers.Contract(token, [
                    'function transfer(address to, uint256 amount) public returns (bool)'
                ], signer);
                const decimals = 18;
                const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
                const tx = await tokenContract.transfer(address, amountInWei);
                await tx.wait();
                return tx.hash;
            } else {
                const tx = {
                    to: address,
                    value: ethers.utils.parseEther(amount.toString())
                };
                const transaction = await signer.sendTransaction(tx);
                await transaction.wait();
                return transaction.hash;
            }
        } catch (error) {
            console.error('BNB transaction error:', error.message);
            throw new Error('Failed to process BNB transaction: ' + error.message);
        }
    }
})();