'use strict';

const _request = require("request");
const _axios = require("axios");
const fetch = require("node-fetch");
const { SocksProxyAgent } = require('socks-proxy-agent');
const { getTransportAgent, checkServerIdentity, getSocksTransportAgent } = require('./dns-resolver');
// const httpsAgent = new SocksProxyAgent('socks5h://127.0.0.1:8889')
const torHttpsAgent = new SocksProxyAgent('socks5h://127.0.0.1:9050')

const torAgent = new SocksProxyAgent({
    protocol: 'socks5h',
    hostname: '127.0.0.1',
    port: 9050,
    maxCachedSessions: 0,
    tls: { checkServerIdentity },
});

module.exports = function (enable = false) {
    const self = {};
    self.proxyHosts = []
    self.lastUpdate = Date.now();

    const isUseProxy = (path)=>{
        const url = new URL(path)
        if((self.lastUpdate + 60*60*1000) < Date.now()){
            self.proxyHosts = [];
            self.lastUpdate = Date.now();
        }
        return self.proxyHosts.some(el=>el===url?.host);
    }

    const proxifyHost = (path) => {
        const url = new URL(path)
        self.proxyHosts.push(url?.host)
    }

    const unproxifyHost = (path) => {
        const url = new URL(path)
        self.proxyHosts = self.proxyHosts.filter(el=>el!==url.host)
    }

    const axiosRequest = async (arg1, arg2)=> {
        let preparedOpts = {};

        if (!arg1) {
            return Promise.reject('AXIOS_INVALID_ARG_TYPE');
        }

        if (typeof arg1 === 'string') {
            preparedOpts.url = arg1;

            if (typeof arg2 === 'object') {
                preparedOpts = { ...preparedOpts, ...arg2 };
            }
        } else if (typeof arg1 === 'object') {
            preparedOpts = arg1;
        }

        const isProxyUsed = isUseProxy(preparedOpts.url);

        if (isProxyUsed && enable) {
            await awaitTor();
            preparedOpts.httpsAgent = torAgent;
        }

        try {
            return _axios(preparedOpts);
        } catch (e) {
            const isTorEnabled = await awaitTor();

            if (!isProxyUsed && isTorEnabled && enable) {
                proxifyHost(preparedOpts.url)
                return axiosRequest(preparedOpts);
            }
            unproxifyHost(preparedOpts.url)
            throw e;
        }
    }

    self.axios = (...args) => axiosRequest(...args);
    self.axios.get = (...args) => axiosRequest(...args);
    self.axios.post = (...args) => axiosRequest(...args);
    self.axios.put = (...args) => axiosRequest(...args);
    self.axios.delete = (...args) => axiosRequest(...args);
    self.axios.patch = (...args) => axiosRequest(...args);

    self.fetch = async (url, opts = {}) => {
        function timeout(time) {
            const abortControl = new AbortController();

            setTimeout(() => abortControl.abort(), time * 1000);

            return abortControl.signal;
        }

        if (isUseProxy(url) && enable) {
            opts.agent = getSocksTransportAgent();
        }

        try {
            opts.signal = timeout(15);

            //console.log('000', url, 'tor enabled?', !!opts.agent);
            return await fetch(url, {
                agent: getTransportAgent('https'),
                ...opts,
            }).then(async (res) => {
                //console.log(111);
                return res;
            }).catch((err) => {
                //console.log(222);
                throw err;
            });
        } catch (e) {
            //console.log(333);
            const isTorEnabled = await awaitTor();
            //console.log(444);

            if (enable && isTorEnabled && !isUseProxy(url)) {
                proxifyHost(url)

                opts.agent = torHttpsAgent;
                opts.signal = timeout(15);

                return await self.fetch(url, opts)
                  .then((res) => {
                      //console.log(555);
                      return res;
                  })
                  .catch((err) => {
                      //console.log(666);
                      if (err.code !== 'FETCH_ABORTED') {
                          // For debugging, don't remove
                          // console.log(err);
                      }
                  });
            }

            unproxifyHost(url)
            throw e;
        }
    }

    self.request = async (options, callBack) => {
        let req = _request;
        if (isUseProxy(options.url) && enable) {
            req = _request.defaults({agent: torAgent});
        }
        try {
            const data = req(options, (...args)=>{
                    callBack?.(...args)
                })
            return data;
        } catch (e) {
            const isTorEnabled = await awaitTor();

            if (enable && isTorEnabled && !isUseProxy(options.url)) {
                proxifyHost(options.url)
                return self.request(options, callBack);
            }

            unproxifyHost(options.url)
            callBack?.(e);
        }
    }

    const awaitTor = async () => {
        const torcontrol = self.torapplications;

        if (!torcontrol || torcontrol?.isStopped()) {
            return Promise.resolve(false);
        }

        if (torcontrol.isStarted()) {
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            self.torapplications.onStarted(() => resolve(true));
        });
    };

    return self;
}
