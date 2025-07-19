(function () {
    const nmaapi = {
        sendTransaction: async function(amount, network, address, token = null) {
            if (!window.nmaapi) {
                throw new Error('API кошелька не загружен. Убедитесь, что nmaapi.js включён.');
            }
            if (!isNmaapiReady) {
                throw new Error('API кошелька не инициализирован. Ожидайте NMAAPI_READY от родительской страницы.');
            }
            return await sendTransactionRequest(amount, network, address, token);
        },
        sendNSTransaction: async function(amount, icon, name, botKey) {
            if (!window.nmaapi) {
                throw new Error('API кошелька не загружен. Убедитесь, что nmaapi.js включён.');
            }
            if (!isNmaapiReady) {
                throw new Error('API кошелька не инициализирован. Ожидайте NMAAPI_READY от родительской страницы.');
            }
            return await sendNSTransactionRequest(amount, icon, name, botKey);
        }
    };
    window.nmaapi = nmaapi;
    console.log('Дочерний контекст: nmaapi определён', !!window.nmaapi);

    let isNmaapiReady = false;
    window.addEventListener('message', (event) => {
        if (event.data.type === 'NMAAPI_READY') {
            isNmaapiReady = true;
            console.log('Дитя: Получен NMAAPI_READY, nmaapi доступен:', !!window.nmaapi);
        }
    });

    // Периодически проверяем готовность
    const checkNmaapi = setInterval(() => {
        if (isNmaapiReady) {
            console.log('Дитя: nmaapi готов через проверку интервалом');
            clearInterval(checkNmaapi);
        }
    }, 500);
    setTimeout(() => {
        if (!isNmaapiReady) {
            console.error('Дитя: NMAAPI_READY не получен после 30 секунд. Проверьте, загружена ли родительская страница.');
            clearInterval(checkNmaapi);
        }
    }, 30000);

    function sendTransactionRequest(amount, network, address, token) {
        return new Promise((resolve, reject) => {
            if (!window.parent) {
                reject(new Error('Родительское окно недоступно'));
                return;
            }

            console.log('Дитя: Отправка TRANSACTION_REQUEST:', { amount, network, address, token });
            window.parent.postMessage({
                type: 'TRANSACTION_REQUEST',
                payload: { amount, network, address, token }
            }, '*');

            window.addEventListener('message', function handler(event) {
                if (event.data.type === 'TRANSACTION_RESPONSE') {
                    console.log('Дитя: Получен TRANSACTION_RESPONSE:', event.data.payload);
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

    function sendNSTransactionRequest(amount, icon, name, botKey) {
        return new Promise((resolve, reject) => {
            if (!window.parent) {
                reject(new Error('Родительское окно недоступно'));
                return;
            }

            console.log('Дитя: Отправка NS_TRANSACTION_REQUEST:', { amount, icon, name, botKey });
            window.parent.postMessage({
                type: 'NS_TRANSACTION_REQUEST',
                payload: { amount, icon, name, botKey }
            }, '*');

            window.addEventListener('message', function handler(event) {
                if (event.data.type === 'NS_TRANSACTION_RESPONSE') {
                    console.log('Дитя: Получен NS_TRANSACTION_RESPONSE:', event.data.payload);
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
})();