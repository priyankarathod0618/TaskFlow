import {initials} from '../../utils/format';
export default function Avatar({name,size='md'}){return <span className={`avatar avatar-${size}`}>{initials(name)}</span>}
