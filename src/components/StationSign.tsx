/** Indian Railways-style station name board: Hindi · English · Marathi. */
export function StationSign() {
  return (
    <div className="station-sign" role="img" aria-label="Campus Daily, IIT Bombay">
      <span className="ss-deva" lang="hi">
        कैंपस डेली
      </span>
      <span className="ss-en">Campus Daily</span>
      <span className="ss-deva" lang="mr">
        कॅम्पस डेली
      </span>
      <span className="ss-foot">
        <span>IIT BOMBAY · POWAI</span>
        <span>STN CODE · CDLY</span>
      </span>
    </div>
  );
}
