/** @type {import('pm2').ProcessConfig[]} */
module.exports = {
	apps: [
		{
			name: "sync-server",
			script: "./src/sync_server/index.ts",
			interpreter: "tsx",
			watch: false,
			instances: 1,
			autorestart: true,
			max_restarts: 10,
			restart_delay: 5000,
			out_file: "./logs/out.log",
			error_file: "./logs/err.log",
			log_date_format: "YYYY-MM-DD HH:mm Z",
			env: { NODE_ENV: "production" }
		}
	]
};
