import CrudPage from './CrudPage.jsx';
import { resources } from './resources.jsx';

// Staff resource configuration is loaded only when a staff table is visited.
export default function ResourceRoute({ resourceKey }) {
  return <CrudPage key={resourceKey} config={resources[resourceKey]} />;
}