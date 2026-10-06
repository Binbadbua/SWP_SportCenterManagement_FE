import { Button } from '../../components/ui.jsx';

const FAQ = [
  ['How do I book a class?', 'Open a class, check its sessions and press “Book this class”. One booking covers every session in that class.'],
  ['Can I cancel?', 'Yes, from My account → Bookings, until you have attended your first session. After that, ask reception.'],
  ['What if a class is full?', 'The class page shows how many spots are left. When it reaches zero, booking closes. Check other classes in the same sport.'],
  ['How do I pay for a membership?', 'Pay at reception for now. Staff create your membership and invoice. Online payment is coming soon.'],
  ['Who marks my attendance?', 'Your coach or reception marks you present, late or absent at each session. You can see it in My account → Attendance.'],
];

export default function Help() {
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1 className="page-title display">Help</h1>
        <p className="page-lead">Answers to the questions we hear most at the front desk.</p>
      </header>
      <div className="accordions">
        {FAQ.map(([q, a], i) => (
          <details key={q} open={i === 0}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <div className="block">
        <Button to="/classes" variant="secondary">Browse classes</Button>
      </div>
    </div>
  );
}
