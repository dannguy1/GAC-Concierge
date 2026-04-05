const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Adds android:usesCleartextTraffic="true" and network_security_config to the manifest
const withCleartextTraffic = (config) => {
    // Step 1: patch AndroidManifest.xml
    config = withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];
        mainApplication.$['android:usesCleartextTraffic'] = 'true';
        mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
        return config;
    });

    // Step 2: create res/xml/network_security_config.xml
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
            fs.mkdirSync(xmlDir, { recursive: true });
            fs.writeFileSync(
                path.join(xmlDir, 'network_security_config.xml'),
                `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>\n`
            );
            return config;
        },
    ]);

    return config;
};

module.exports = withCleartextTraffic;
