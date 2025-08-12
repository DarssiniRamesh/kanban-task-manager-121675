#!/bin/bash
cd /home/kavia/workspace/code-generation/kanban-task-manager-121675/kanban_board_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

