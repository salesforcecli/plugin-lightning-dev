import salesforce from 'eslint-config-salesforce-typescript';
import sfPlugin from 'eslint-plugin-sf-plugin';

export default [...salesforce, ...sfPlugin.configs.recommended];
