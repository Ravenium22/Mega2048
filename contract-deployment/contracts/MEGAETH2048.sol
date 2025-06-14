// contracts/MEGAETH2048.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Board} from "./LibBoard.sol";

struct GameState {
    uint8 move;
    uint120 nextMove;
    uint128 board;
}

/**
 * @title  MEGAETH 2048
 * @author Adapted from Monad Foundation 2048
 * @notice Play 2048 onchain using MEGAETH's fast block times
 */
contract MEGAETH2048 {
    // =============================================================//
    //                            ERRORS                            //
    // =============================================================//

    /// @dev Emitted when starting a game with a used ID.
    error GameIdUsed();
    /// @dev Emitted when starting a game that has already been played.
    error GamePlayed();
    /// @dev Emitted when submitting an invalid game board.
    error GameBoardInvalid();
    /// @dev Emitted when someone other than a game's player makes a move.
    error GamePlayerInvalid();

    // =============================================================//
    //                            EVENT                             //
    // =============================================================//

    /// @dev Emitted when a game is started.
    event NewGame(address indexed player, bytes32 indexed id, uint256 board);
    /// @dev Emitted when a new valid move is played.
    event NewMove(address indexed player, bytes32 indexed id, uint256 move, uint256 result);
    /// @dev Emitted when a move is confirmed in a block.
    event MoveConfirmed(address indexed player, bytes32 indexed id, uint256 move, uint256 blockNumber);

    // =============================================================//
    //                           STORAGE                            //
    // =============================================================//

    /// @notice Mapping from game ID to the latest board state.
    mapping(bytes32 gameId => GameState state) public state;
    /// @notice Mapping from a hash of start position plus first 3 moves to game ID.
    mapping(bytes32 gameHash => bytes32 gameId) public gameHashOf;
    /// @notice Tracks the confirmation status of moves (gameId => moveNumber => confirmed)
    mapping(bytes32 gameId => mapping(uint256 moveNumber => bool confirmed)) public moveConfirmed;

    // =============================================================//
    //                          MODIFIERS                           //
    // =============================================================//

    modifier correctGameId(address player, bytes32 gameId) {
        require(player == address(uint160(uint256(gameId) >> 96)), "GamePlayerInvalid");
        _;
    }

    // =============================================================//
    //                             VIEW                             //
    // =============================================================//

    function nextMove(bytes32 gameId) public view returns (uint120) {
        return state[gameId].nextMove;
    }

    function latestBoard(bytes32 gameId) public view returns (uint128) {
        return state[gameId].board;
    }

    /**
     * @notice Returns the latest board position of a game.
     * @dev Each array position stores the log_2 of that tile's value.
     * @param gameId The unique ID of a game.
     */
    function getBoard(bytes32 gameId) external view returns (uint8[16] memory boardArr, uint256 nextMoveNumber) {
        uint128 b = latestBoard(gameId);
        for (uint8 i = 0; i < 16; i++) {
            boardArr[i] = Board.getTile(b, i);
        }
        nextMoveNumber = nextMove(gameId);
    }

    /**
     * @notice Check if a move has been confirmed in a block
     * @param gameId The unique ID of a game
     * @param moveNumber The move number to check
     */
    function isMoveConfirmed(bytes32 gameId, uint256 moveNumber) external view returns (bool) {
        return moveConfirmed[gameId][moveNumber];
    }

    // =============================================================//
    //                           EXTERNAL                           //
    // =============================================================//

    /**
     * @notice Starts a new game for a player.
     *
     * @param gameId The unique ID of the game.
     * @param boards An ordered series of a start board and the result boards
     *               of the first three moves.
     */
    function startGame(bytes32 gameId, uint128[4] calldata boards, uint8[3] calldata moves)
        external
        correctGameId(msg.sender, gameId)
    {
        require(state[gameId].board == 0, "GameIdUsed");

        // Check: this exact sequence of boards has not been played.
        bytes32 hashedBoards = keccak256(abi.encodePacked(boards));
        require(gameHashOf[hashedBoards] == bytes32(0), "GamePlayed");

        // Check: game has a valid start board.
        require(Board.validateStartPosition(boards[0]), "GameBoardInvalid");

        // Check: game has valid board transformations.
        for (uint256 i = 1; i < 4; i++) {
            require(
                Board.validateTransformation(
                    boards[i - 1], moves[i - 1], boards[i], uint256(keccak256(abi.encodePacked(gameId, i)))
                ),
                "GameBoardInvalid"
            );
        }

        // Mark the game-start as played.
        gameHashOf[hashedBoards] = gameId;
        
        // Set initial moves as confirmed
        for (uint256 i = 1; i <= 3; i++) {
            moveConfirmed[gameId][i] = true;
        }

        state[gameId] = GameState({move: moves[2], nextMove: uint120(4), board: boards[3]});

        emit NewGame(msg.sender, gameId, boards[3]);
        emit MoveConfirmed(msg.sender, gameId, 3, block.number);
    }

    /**
     * @notice Makes a new move in a game.
     * @param gameId The unique ID of the game.
     * @param move The move to make (UP, DOWN, LEFT, RIGHT)
     * @param resultBoard The result of applying a move on the latest board.
     */
    function play(bytes32 gameId, uint8 move, uint128 resultBoard) external correctGameId(msg.sender, gameId) {
        GameState memory latestState = state[gameId];

        // Check: playing a valid move.
        require(
            Board.validateTransformation(
                latestState.board,
                move,
                resultBoard,
                uint256(keccak256(abi.encodePacked(gameId, uint256(latestState.nextMove))))
            ),
            "GameBoardInvalid"
        );

        // Update board.
        uint256 currentMoveNumber = latestState.nextMove;
        state[gameId] = GameState({move: move, nextMove: latestState.nextMove + 1, board: resultBoard});
        
        // Mark the move as confirmed
        moveConfirmed[gameId][currentMoveNumber] = true;

        emit NewMove(msg.sender, gameId, move, resultBoard);
        emit MoveConfirmed(msg.sender, gameId, currentMoveNumber, block.number);
    }

    /**
     * @notice Calculate the seed for a specific move
     * @param gameId The unique ID of the game
     * @param moveNumber The move number
     */
    function calculateSeed(bytes32 gameId, uint256 moveNumber) external pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(gameId, moveNumber)));
    }
}