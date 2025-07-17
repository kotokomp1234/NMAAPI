(function () {
    // Определяем объект nmaapi
    const nmaapi = {
        sendTransaction: async function(amount, network, address, token = null) {
            console.log('Дитя: Вызов sendTransaction с параметрами:', { amount, network, address, token });
            if (!window.nmaapi) {
                console.error('Дитя: window.nmaapi не определён');
                throw new Error('API кошелька не загружен. Убедитесь, что nmaapi-child.js включён.');
            }
            if (!isNmaapiReady) {
                console.error('Дитя: isNmaapiReady = false, NMAAPI_READY не получен');
                throw new Error('API кошелька не инициализирован. Ожидайте NMAAPI_READY от родительской страницы.');
            }
            return await sendTransactionRequest(amount, network, address, token);
        }
    };

    // Экспортируем nmaapi глобально
    window.nmaapi = nmaapi;
    console.log('Дочерний контекст: nmaapi определён', !!window.nmaapi);

    // Проверка на переопределение window.nmaapi
    Object.defineProperty(window, 'nmaapi', {
        value: nmaapi,
        writable: false,
        configurable: false
    });

    // Ожидаем NMAAPI_READY
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
    // Прекращаем проверку после 30 секунд
    setTimeout(() => {
        if (!isNmaapiReady) {
            console.error('Дитя: NMAAPI_READY не получен после 30 секунд. Проверьте, загружена ли родительская страница.');
            clearInterval(checkNmaapi);
        }
    }, 30000);

    // Отправка запроса транзакции
    function sendTransactionRequest(amount, network, address, token) {
        return new Promise((resolve, reject) => {
            if (!window.parent) {
                console.error('Дитя: window.parent недоступен');
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
})();
