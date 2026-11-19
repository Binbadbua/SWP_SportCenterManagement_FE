import CrudPage from './CrudPage.jsx';
import { resources } from './resources.jsx';

export default function ResourceRoute({ resourceKey }) {
  return <CrudPage key={resourceKey} config={resources[resourceKey]} />;
}