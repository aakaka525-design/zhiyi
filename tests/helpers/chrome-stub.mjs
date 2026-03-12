export function installChromeStub() {
    const store = {};

    function reset() {
        Object.keys(store).forEach((key) => {
            delete store[key];
        });
    }

    globalThis.chrome = {
        storage: {
            local: {
                async get(key) {
                    if (typeof key === 'string') {
                        return { [key]: store[key] };
                    }

                    if (Array.isArray(key)) {
                        const result = {};
                        key.forEach((item) => {
                            if (item in store) {
                                result[item] = store[item];
                            }
                        });
                        return result;
                    }

                    if (key && typeof key === 'object') {
                        const result = {};
                        Object.entries(key).forEach(([item, defaultValue]) => {
                            result[item] = item in store ? store[item] : defaultValue;
                        });
                        return result;
                    }

                    return { ...store };
                },

                async set(items) {
                    Object.assign(store, items);
                },

                async remove(keys) {
                    const list = Array.isArray(keys) ? keys : [keys];
                    list.forEach((key) => {
                        delete store[key];
                    });
                },
            },
        },
    };

    return { store, reset };
}
