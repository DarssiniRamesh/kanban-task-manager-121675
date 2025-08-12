import React, { useMemo } from 'react';
import { useKanban } from '../KanbanContext';
import { getKnownAssignees } from '../utils/assignees';

/**
 * PUBLIC_INTERFACE
 * AssigneeAutocomplete
 * A minimal autocomplete input using native <datalist> to suggest existing assignees.
 * Allows free text entry when no suggestion matches.
 *
 * Props:
 *  - name: string (required) - input name for form submission
 *  - value?: string - optional controlled value
 *  - onChange?: function - change handler (receives native event)
 *  - placeholder?: string
 *  - className?: string
 *  - style?: object
 *  - idSuffix?: string - optional suffix to keep datalist id unique when multiple inputs exist
 *  - inputProps?: object - additional props to spread on the <input>
 */
function AssigneeAutocomplete({
  name,
  value,
  onChange,
  placeholder = 'Assignee',
  className,
  style,
  idSuffix,
  inputProps = {},
}) {
  const { cards } = useKanban();

  // Build suggestion options from current cards + localStorage
  const options = useMemo(() => getKnownAssignees(cards), [cards]);

  const listId = useMemo(() => {
    const suffix = idSuffix || name || 'assignee';
    return `assignee-datalist-${suffix}`;
  }, [idSuffix, name]);

  return (
    <>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={className}
        style={style}
        list={listId}
        {...inputProps}
      />
      <datalist id={listId}>
        {options.map(opt => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}

export default AssigneeAutocomplete;
