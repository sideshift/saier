import main from '.';
import { readConfig } from './config';

const config = readConfig();

main(config)
  .then(() => process.exit())
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
