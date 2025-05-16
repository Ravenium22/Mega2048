type GetOptions = {
    url: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    includeCredentials?: boolean;
    retries?: number;  
    retryDelay?: number;  
};

export async function get({ 
    url, 
    params, 
    headers, 
    includeCredentials = false,
    retries = 3,  
    retryDelay = 1000  
}: GetOptions) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            
            if (attempt > 0) {
                console.log(`Retry attempt ${attempt}/${retries} for ${url}`);
            }
            
            const response = await fetch(url + "?" + new URLSearchParams(params), {
                method: "GET",
                headers,
                credentials: includeCredentials ? "include" : "omit",
                
                cache: 'no-cache'
            });

            if (!response.ok) {
                console.error(`HTTP error ${response.status}: ${response.statusText}`);
                throw new Error(response.statusText || `HTTP error ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;
            console.error(`Fetch error (attempt ${attempt + 1}/${retries + 1}):`, error);
            
            
            if (attempt === retries) {
                throw error;
            }
            
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    
    throw lastError;
}

type PostOptions = {
    url: string;
    params?: Record<string, unknown> | any[];
    headers?: Record<string, string>;
    includeCredentials?: boolean;
    retries?: number;  
    retryDelay?: number; 
};

export async function post({ 
    url, 
    params, 
    headers, 
    includeCredentials = false,
    retries = 3,  
    retryDelay = 1000  
}: PostOptions) {
    
    const isMegaEthRpc = url.includes('megaeth.com/rpc') || url.includes('megaeth-rpc');
    
    
    const requestHeaders = {
        "Content-Type": "application/json",
        ...headers,
    };
    
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            
            if (attempt > 0) {
                console.log(`Retry attempt ${attempt}/${retries} for ${url}`);
            }
            
            const response = await fetch(url, {
                method: "POST",
                headers: requestHeaders,
                body: JSON.stringify(params ?? {}),
                credentials: includeCredentials ? "include" : "omit",
                
                mode: isMegaEthRpc ? 'cors' : undefined,
                
                cache: 'no-cache'
            });

            if (!response.ok) {
                console.error(`HTTP error ${response.status}: ${response.statusText}`);
                throw new Error(response.statusText || `HTTP error ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;
            console.error(`Fetch error (attempt ${attempt + 1}/${retries + 1}):`, error);
            
            
            if (url.includes('/megaeth-rpc') && window.location.hostname === 'localhost') {
                console.error("Proxy endpoint not found. Make sure your vite.config.ts is properly configured with the proxy.");
            }
            
            
            if (attempt === retries) {
                throw error;
            }
            
            // Wait before next retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    
    throw lastError;
}
