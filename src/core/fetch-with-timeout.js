export function fetchWithTimeout(url, options = {}, timeoutMs, timeoutMessage = '请求超时') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...options, signal: controller.signal })
        .catch(err => {
            if (err.name === 'AbortError') {
                throw new Error(timeoutMessage);
            }
            throw err;
        })
        .finally(() => clearTimeout(timeoutId));
}
