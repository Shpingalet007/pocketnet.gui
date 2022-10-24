const http = require('http');
const https = require('https');
const dns = require('dns/promises');
const { SocksProxyAgent } = require('socks-proxy-agent');
const tls = require("tls");
const fs = require("fs");
const fetch = require('node-fetch');

const anyDnsList = require('./dns.json');
const ptDnsListRaw = require('./peertube-servers.json');

const origCreateSecureContext = tls.createSecureContext;

const dnsList = [
	...Object.keys(anyDnsList).map(lk => anyDnsList[lk]).flat(),
	...ptDnsListRaw.combat.map(s => s.main),
	...ptDnsListRaw.combat.map(s => s.mirror),
	...ptDnsListRaw.test.map(s => s.main),
	...ptDnsListRaw.test.map(s => s.mirror)
].filter(e => !!e);

const hybridLookup = () => async (hostname, _, cb) => {
	const resolver = new dns.Resolver({ tries: 2, timeout: 3000 });
	resolver.setServers([...dns.getServers(), '76.76.2.0', '76.76.10.0']);

	const resolvedIps = await resolver.resolve(hostname);
	const localIps = [dnsList.find(h => h.host === hostname)?.ip].filter(e => !!e);

	if (!resolvedIps.length && !localIps.length) {
		throw new Error(`Unable to resolve ${hostname}`);
	}

	if (resolvedIps.length) {
		cb(null, resolvedIps[0], 4);
		return;
	}

	cb(null, localIps[0], 4);
};

const checkServerIdentity = (hostname, cert) => {
	const err = tls.checkServerIdentity(hostname, cert);

	if (err) {
		return err;
	}

	const localSslPins = dnsList.find(h => h.host === hostname)?.security || [];
	const sslFingerprint = cert.fingerprint.replaceAll(':', '');

	const isCheckEnabledForHost = (localSslPins.length !== 0);
	const foundSslPin = localSslPins.some(p => p === sslFingerprint);

	if (isCheckEnabledForHost && !foundSslPin) {
		const msg = `Certificate pinning error for ${hostname}`;
		console.log('-------');
		console.log(msg);
		console.log(hostname, sslFingerprint);
		console.log('-------');
		return new Error(msg);
	}

	const msg = `Certificate pinning correct for ${hostname}`;
	console.log(msg);
}

const getTransportAgent = (scheme) => {
	const httpModule = scheme === 'http' ? http : https;

	return new httpModule.Agent({
		lookup: hybridLookup(),
		maxCachedSessions: 0,
		checkServerIdentity,
	});
};

module.exports = { getTransportAgent, checkServerIdentity };
